import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import {
  assignByTierQuota,
  selectQuotaTeamForPlayer,
  selectQuotaPlayerForTeam,
} from '@/lib/teamAssignment';

// Server-side, transactional spin-wheel assignment.
//
// All assignment writes go through this route so they run inside a single
// Firestore transaction using the Admin SDK. Reads happen *inside* the
// transaction, so the player arrays we extend are always the freshest values
// — this eliminates the lost-update / clobbering races the old client-side
// read-modify-write path suffered from (two admins/tabs, or a stale React
// snapshot, could silently drop players). The pure balancing logic in
// lib/teamAssignment.ts is reused verbatim.
//
// NOTE: like the other admin API routes in this project (create-user,
// send-notification, …) this endpoint trusts the caller and relies on the app
// only exposing it to admins. If you later want defence in depth, verify a
// Firebase ID token from an Authorization header and check the caller's role.

export const runtime = 'nodejs';

type Action = 'single' | 'round' | 'all' | 'manual';

interface Body {
  tournamentId: string;
  category: string;
  isTeamCategory: boolean;
  action: Action;
  playerId?: string; // manual
  targetId?: string; // manual (team or pool id)
}

interface AssignResult {
  playerId: string;
  targetId: string;
  targetName: string;
}

interface Payload {
  results: AssignResult[];
  reason?: string;
  unassignedCount?: number;
}

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const byNameNumeric = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, undefined, { numeric: true });

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const SURPLUS_REASON =
  'Remaining players are surplus at skill levels the teams already have. Use Auto Assign All or assign manually.';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Body;
    const { tournamentId, category, isTeamCategory, action } = body;

    if (!tournamentId || !category || !action) {
      return NextResponse.json(
        { error: 'tournamentId, category and action are required' },
        { status: 400 },
      );
    }

    const db = getAdminFirestore();
    const base = db.collection('tournaments').doc(tournamentId);
    const teamsCol = base.collection('teams');
    const poolsCol = base.collection('pools');
    const regsCol = base.collection('registrations');

    const payload = await db.runTransaction(async (tx): Promise<Payload> => {
      // ---- reads (must precede any writes in a Firestore transaction) ----
      const regsSnap = await tx.get(regsCol.where('selectedCategory', '==', category));
      const levelById = new Map<string, string>();
      const categoryPlayerIds: string[] = [];
      regsSnap.forEach(d => {
        categoryPlayerIds.push(d.id);
        levelById.set(d.id, (d.data().expertiseLevel as string) ?? 'beginner');
      });
      const levelOf = (id: string) => levelById.get(id) ?? 'beginner';

      const stamp = FieldValue.serverTimestamp();

      if (isTeamCategory) {
        const teamsSnap = await tx.get(teamsCol.where('category', '==', category));
        const teams = teamsSnap.docs
          .map(d => ({
            id: d.id,
            name: (d.data().name as string) ?? '',
            players: ((d.data().players as string[]) ?? []),
            maxPlayers: d.data().maxPlayers as number | undefined,
          }))
          .sort(byNameNumeric);

        if (teams.length === 0) {
          throw new HttpError(400, 'No teams found for this category.');
        }

        const assignedIds = new Set(teams.flatMap(t => t.players));
        const unassigned = categoryPlayerIds.filter(id => !assignedIds.has(id));

        // ----- manual: explicit admin override (skips the quota) -----
        if (action === 'manual') {
          const { playerId, targetId } = body;
          if (!playerId || !targetId) throw new HttpError(400, 'playerId and targetId are required.');
          const team = teams.find(t => t.id === targetId);
          if (!team) throw new HttpError(404, 'Team not found.');
          if (!team.players.includes(playerId)) {
            tx.update(teamsCol.doc(team.id), {
              players: [...team.players, playerId],
              updatedAt: stamp,
            });
          }
          return { results: [{ playerId, targetId: team.id, targetName: team.name }] };
        }

        // ----- single spin: pick one placeable player at random -----
        if (action === 'single') {
          const placeable = shuffle(unassigned).filter(
            id => selectQuotaTeamForPlayer(levelOf(id), teams, levelOf) !== undefined,
          );
          if (placeable.length === 0) {
            return { results: [], reason: unassigned.length ? SURPLUS_REASON : 'No unassigned players.' };
          }
          const playerId = placeable[0];
          const team = selectQuotaTeamForPlayer(levelOf(playerId), teams, levelOf)!;
          tx.update(teamsCol.doc(team.id), {
            players: [...team.players, playerId],
            updatedAt: stamp,
          });
          return { results: [{ playerId, targetId: team.id, targetName: team.name }] };
        }

        // ----- round: at most one player per team this spin -----
        if (action === 'round') {
          const order = shuffle(unassigned);
          const used = new Set<string>();
          const local: Record<string, string[]> = Object.fromEntries(
            teams.map(t => [t.id, [...t.players]]),
          );
          const results: AssignResult[] = [];
          for (const team of teams) {
            if (team.maxPlayers != null && local[team.id].length >= team.maxPlayers) continue;
            const available = order.filter(id => !used.has(id));
            const pick = selectQuotaPlayerForTeam(available, local[team.id], levelOf);
            if (!pick) continue;
            used.add(pick);
            local[team.id].push(pick);
            tx.update(teamsCol.doc(team.id), { players: local[team.id], updatedAt: stamp });
            results.push({ playerId: pick, targetId: team.id, targetName: team.name });
          }
          return { results, reason: results.length ? undefined : SURPLUS_REASON };
        }

        // ----- all: one expert/advanced/intermediate per team, rest beginners -----
        const { assignments, unassigned: surplus } = assignByTierQuota(unassigned, teams, levelOf);
        const results: AssignResult[] = [];
        for (const team of teams) {
          const before = new Set(team.players);
          const added = assignments[team.id].filter(id => !before.has(id));
          if (added.length === 0) continue;
          tx.update(teamsCol.doc(team.id), { players: assignments[team.id], updatedAt: stamp });
          for (const id of added) results.push({ playerId: id, targetId: team.id, targetName: team.name });
        }
        return { results, unassignedCount: surplus.length };
      }

      // ===================== pool categories =====================
      const poolsSnap = await tx.get(poolsCol.where('category', '==', category));
      const pools = poolsSnap.docs
        .map(d => ({
          id: d.id,
          name: (d.data().name as string) ?? '',
          teams: ((d.data().teams as string[]) ?? []), // player ids for non-team categories
        }))
        .sort(byNameNumeric);

      if (pools.length === 0) {
        throw new HttpError(400, 'No pools found for this category.');
      }

      const assignedIds = new Set(pools.flatMap(p => p.teams));
      const unassigned = categoryPlayerIds.filter(id => !assignedIds.has(id));
      const smallest = (ps: typeof pools) =>
        ps.reduce((min, p) => (p.teams.length < min.teams.length ? p : min), ps[0]);

      if (action === 'manual') {
        const { playerId, targetId } = body;
        if (!playerId || !targetId) throw new HttpError(400, 'playerId and targetId are required.');
        const pool = pools.find(p => p.id === targetId);
        if (!pool) throw new HttpError(404, 'Pool not found.');
        if (!pool.teams.includes(playerId)) {
          tx.update(poolsCol.doc(pool.id), { teams: [...pool.teams, playerId], updatedAt: stamp });
        }
        return { results: [{ playerId, targetId: pool.id, targetName: pool.name }] };
      }

      if (action === 'single') {
        if (unassigned.length === 0) return { results: [], reason: 'No unassigned players.' };
        const playerId = shuffle(unassigned)[0];
        const pool = smallest(pools);
        tx.update(poolsCol.doc(pool.id), { teams: [...pool.teams, playerId], updatedAt: stamp });
        return { results: [{ playerId, targetId: pool.id, targetName: pool.name }] };
      }

      // round / all for pools: distribute evenly into the smallest pool each time.
      const order = shuffle(unassigned);
      const take = action === 'round' ? Math.min(order.length, pools.length) : order.length;
      const local: Record<string, string[]> = Object.fromEntries(pools.map(p => [p.id, [...p.teams]]));
      const results: AssignResult[] = [];
      for (let i = 0; i < take; i++) {
        const playerId = order[i];
        const pool = pools.reduce(
          (min, p) => (local[p.id].length < local[min.id].length ? p : min),
          pools[0],
        );
        local[pool.id].push(playerId);
        results.push({ playerId, targetId: pool.id, targetName: pool.name });
      }
      for (const pool of pools) {
        if (local[pool.id].length !== pool.teams.length) {
          tx.update(poolsCol.doc(pool.id), { teams: local[pool.id], updatedAt: stamp });
        }
      }
      return { results };
    });

    return NextResponse.json({ success: true, ...payload });
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('Error assigning players:', error);
    const message = error instanceof Error ? error.message : 'Failed to assign players';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
