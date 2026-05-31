'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PublicLayout } from '@/components/PublicLayout';
import { Tournament, Registration, Team, Pool } from '@/types';
import { ArrowLeft, Shield, Users, Star, Trophy, Users2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

// ── helpers ────────────────────────────────────────────────────────────────
function fmtCategory(cat: string) {
  return cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function isTeamCategory(cat: string) {
  const kids = cat.includes('kids-team-u13') || cat.includes('kids-team-u18');
  return (cat.includes('team') || cat.includes('doubles')) && !kids;
}

const LEVEL_COLOR: Record<string, string> = {
  beginner: 'bg-emerald-500',
  intermediate: 'bg-blue-500',
  advanced: 'bg-violet-500',
  expert: 'bg-orange-500',
};

const CARD_GRADIENTS = [
  'from-blue-900 to-blue-700',
  'from-purple-900 to-purple-700',
  'from-emerald-900 to-emerald-700',
  'from-rose-900 to-rose-700',
  'from-amber-900 to-amber-700',
  'from-cyan-900 to-cyan-700',
  'from-indigo-900 to-indigo-700',
  'from-teal-900 to-teal-700',
];

const TEAM_HEADER_GRADIENTS = [
  'from-blue-600/30 to-blue-500/10',
  'from-violet-600/30 to-violet-500/10',
  'from-emerald-600/30 to-emerald-500/10',
  'from-rose-600/30 to-rose-500/10',
  'from-amber-600/30 to-amber-500/10',
  'from-cyan-600/30 to-cyan-500/10',
  'from-indigo-600/30 to-indigo-500/10',
  'from-teal-600/30 to-teal-500/10',
];

// ── Player card (IPL squad style) ──────────────────────────────────────────
function PlayerCard({ player, index, isCaptain }: { player: Registration; index: number; isCaptain?: boolean }) {
  const initials = player.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const grad = CARD_GRADIENTS[player.name.charCodeAt(0) % CARD_GRADIENTS.length];
  const levelColor = LEVEL_COLOR[player.expertiseLevel] ?? 'bg-gray-500';

  return (
    <div className="group relative rounded-xl overflow-hidden border border-white/5 shadow hover:shadow-xl transition-all duration-200 hover:-translate-y-1 bg-slate-900">
      {/* Portrait area */}
      <div className={`relative bg-gradient-to-b ${grad} overflow-hidden`} style={{ aspectRatio: '3/4' }}>
        {player.profilePhotoUrl ? (
          <Image src={player.profilePhotoUrl} alt={player.name} fill className="object-cover object-top" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white text-3xl font-bold">
              {initials}
            </div>
          </div>
        )}
        {/* Bottom gradient */}
        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent" />

        {/* Captain badge */}
        {isCaptain && (
          <div className="absolute top-2 left-2 flex items-center gap-1 bg-yellow-400 text-black text-[9px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wide">
            <Star className="h-2.5 w-2.5 fill-black" /> C
          </div>
        )}

        {/* Level badge */}
        <div className="absolute top-2 right-2">
          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase text-white ${levelColor}`}>
            {player.expertiseLevel}
          </span>
        </div>

        {/* Flat on gradient bottom */}
        {(player.tower || player.flatNumber) && (
          <p className="absolute bottom-1.5 left-0 right-0 text-center text-[10px] text-white/70 font-medium">
            {player.tower}{player.flatNumber ? ` - ${player.flatNumber}` : ''}
          </p>
        )}
      </div>

      {/* Name strip */}
      <div className="px-2 py-2 text-center">
        <p className="text-xs font-black uppercase tracking-wide text-white leading-tight truncate" title={player.name}>
          {player.name}
        </p>
        {player.partnerName && (
          <p className="text-[10px] text-slate-400 mt-0.5 truncate">w/ {player.partnerName}</p>
        )}
      </div>
    </div>
  );
}

// ── Pool standings table ───────────────────────────────────────────────────
function PoolStandings({ pool, teams, participants, isTeamCat }: {
  pool: Pool;
  teams: Team[];
  participants: Registration[];
  isTeamCat: boolean;
}) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600/20 to-indigo-500/10 px-5 py-3 border-b border-white/5 flex items-center justify-between">
        <div>
          <h4 className="font-black text-white">{pool.name}</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            {pool.teams.length} {isTeamCat ? 'teams' : 'players'} · max {pool.maxTeams}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${pool.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
          {pool.status}
        </span>
      </div>
      <div className="divide-y divide-white/5">
        {pool.teams.map((itemId, idx) => {
          if (isTeamCat) {
            const team = teams.find(t => t.id === itemId);
            return (
              <div key={idx} className="flex items-center gap-3 px-5 py-3">
                <span className="w-6 h-6 rounded-full bg-purple-500/20 text-purple-300 text-xs font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                <p className="text-sm font-semibold text-white">{team?.name ?? `Team ${idx + 1}`}</p>
                {team && <span className="ml-auto text-xs text-slate-400">{team.players.length} players</span>}
              </div>
            );
          } else {
            const player = participants.find(p => p.id === itemId);
            const initials = player?.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase() ?? '?';
            return (
              <div key={idx} className="flex items-center gap-3 px-5 py-3">
                <span className="w-6 h-6 rounded-full bg-slate-700 text-slate-300 text-xs font-bold flex items-center justify-center flex-shrink-0">{idx + 1}</span>
                {player?.profilePhotoUrl ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-white/10">
                    <Image src={player.profilePhotoUrl} alt={player.name} width={32} height={32} className="object-cover" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">{initials}</div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-white truncate">{player?.name ?? `Player ${idx + 1}`}</p>
                  {(player?.tower || player?.flatNumber) && (
                    <p className="text-[10px] text-slate-500">{player.tower} {player.flatNumber}</p>
                  )}
                </div>
                {player && (
                  <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full text-white ${LEVEL_COLOR[player.expertiseLevel] ?? 'bg-gray-500'}`}>
                    {player.expertiseLevel}
                  </span>
                )}
              </div>
            );
          }
        })}
        {pool.teams.length === 0 && (
          <p className="text-sm text-slate-500 italic px-5 py-4">No {isTeamCat ? 'teams' : 'players'} assigned yet</p>
        )}
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────
export default function CategoryPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const categorySlug = params.category as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [participants, setParticipants] = useState<Registration[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'squads' | 'pools'>('squads');

  useEffect(() => {
    if (tournamentId) loadAll();
  }, [tournamentId]);

  const loadAll = async () => {
    try {
      const [tSnap, regSnap, teamSnap, poolSnap] = await Promise.all([
        getDoc(doc(db, 'tournaments', tournamentId)),
        getDocs(query(collection(db, 'tournaments', tournamentId, 'registrations'), orderBy('registeredAt', 'desc'))),
        getDocs(query(collection(db, 'tournaments', tournamentId, 'teams'), orderBy('createdAt', 'desc'))),
        getDocs(query(collection(db, 'tournaments', tournamentId, 'pools'), orderBy('createdAt', 'desc'))),
      ]);

      if (tSnap.exists()) {
        const d = tSnap.data();
        setTournament({ id: tSnap.id, ...d, startDate: d.startDate?.toDate(), endDate: d.endDate?.toDate(), registrationDeadline: d.registrationDeadline?.toDate(), createdAt: d.createdAt?.toDate(), updatedAt: d.updatedAt?.toDate() } as Tournament);
      }

      setParticipants(regSnap.docs.map(d => ({ id: d.id, ...d.data(), registeredAt: d.data().registeredAt?.toDate() })) as Registration[]);
      setTeams(teamSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() })) as Team[]);
      setPools(poolSnap.docs.map(d => ({ id: d.id, ...d.data(), createdAt: d.data().createdAt?.toDate(), updatedAt: d.data().updatedAt?.toDate() })) as Pool[]);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  if (loading) {
    return (
      <PublicLayout>
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      </PublicLayout>
    );
  }

  // ── filtered data for this category ──
  const catTeams = teams.filter(t => t.category === categorySlug);
  const catPlayers = participants.filter(p => p.selectedCategory === categorySlug);
  const catPools = pools.filter(p => p.category === categorySlug);
  const isCatTeam = isTeamCategory(categorySlug);
  const label = fmtCategory(categorySlug);

  // For individual categories — show players as squad cards
  // For team categories — show teams with their players inside

  const poolsAvailable = catPools.length > 0;

  return (
    <PublicLayout>
      <div className="bg-slate-950 min-h-screen">

        {/* ── HERO ─────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950">
          {/* Decorative glow */}
          <div className="absolute -top-32 -right-32 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

          <div className="relative max-w-7xl mx-auto px-6 pt-10 pb-10">
            {/* Breadcrumb */}
            <Link href={`/tournament/${tournamentId}`} className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-6 transition-colors group">
              <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
              {tournament?.name ?? 'Tournament'}
            </Link>

            <div className="flex flex-col sm:flex-row sm:items-end gap-4">
              <div className="flex-1">
                <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-2">Category</p>
                <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight">{label}</h1>
                <div className="flex flex-wrap gap-3 mt-4 text-sm text-slate-400">
                  {isCatTeam ? (
                    <span className="flex items-center gap-1.5"><Shield className="h-4 w-4 text-purple-400" />{catTeams.length} Teams</span>
                  ) : null}
                  <span className="flex items-center gap-1.5"><Users className="h-4 w-4 text-blue-400" />{catPlayers.length} Players</span>
                  {poolsAvailable && <span className="flex items-center gap-1.5"><Users2 className="h-4 w-4 text-emerald-400" />{catPools.length} Pools</span>}
                </div>
              </div>

              {/* Section switcher */}
              {poolsAvailable && (
                <div className="flex gap-1 bg-slate-800 p-1 rounded-full self-start sm:self-end">
                  {([['squads', isCatTeam ? 'Squads' : 'Players'], ['pools', 'Pools']] as const).map(([id, lbl]) => (
                    <button key={id} onClick={() => setActiveSection(id)}
                      className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all ${activeSection === id ? 'bg-yellow-400 text-black' : 'text-slate-400 hover:text-white'}`}>
                      {lbl}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-12">

          {/* ── SQUADS / PLAYERS ─────────────────────────────────── */}
          {activeSection === 'squads' && (
            <>
              {isCatTeam ? (
                /* TEAM CATEGORIES — one section per team */
                catTeams.length === 0 ? (
                  <div className="text-center py-24">
                    <Shield className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No teams assigned to this category yet</p>
                  </div>
                ) : (
                  catTeams.map((team, ti) => {
                    const players = team.players
                      .map(id => participants.find(p => p.id === id))
                      .filter(Boolean) as Registration[];
                    const grad = TEAM_HEADER_GRADIENTS[ti % TEAM_HEADER_GRADIENTS.length];

                    return (
                      <section key={team.id}>
                        {/* Team header */}
                        <div className={`flex items-center justify-between bg-gradient-to-r ${grad} rounded-2xl px-6 py-5 mb-5 border border-white/5`}>
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                              <Shield className="h-6 w-6 text-white/80" />
                            </div>
                            <div>
                              <h2 className="text-2xl font-black text-white">{team.name}</h2>
                              <p className="text-sm text-white/50 mt-0.5">{players.length} players</p>
                            </div>
                          </div>
                          {team.captainId && (
                            <div className="hidden sm:flex items-center gap-2 bg-yellow-400/10 border border-yellow-400/20 rounded-full px-4 py-1.5">
                              <Star className="h-3.5 w-3.5 text-yellow-400 fill-yellow-400" />
                              <span className="text-xs font-bold text-yellow-400">
                                Captain: {participants.find(p => p.id === team.captainId)?.name ?? '—'}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Player cards grid */}
                        {players.length === 0 ? (
                          <p className="text-slate-500 text-sm italic px-2">No players assigned yet</p>
                        ) : (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                            {players.map((player, i) => (
                              <PlayerCard
                                key={player.id}
                                player={player}
                                index={i}
                                isCaptain={player.id === team.captainId}
                              />
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })
                )
              ) : (
                /* INDIVIDUAL CATEGORIES — all players as IPL cards */
                catPlayers.length === 0 ? (
                  <div className="text-center py-24">
                    <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-400">No players registered in this category yet</p>
                  </div>
                ) : (
                  <section>
                    <h2 className="text-xs uppercase tracking-widest text-yellow-400 font-bold mb-5 flex items-center gap-2">
                      <Trophy className="h-3.5 w-3.5" /> Players — {label}
                    </h2>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {catPlayers.map((player, i) => (
                        <PlayerCard key={player.id} player={player} index={i} />
                      ))}
                    </div>
                  </section>
                )
              )}
            </>
          )}

          {/* ── POOLS ────────────────────────────────────────────── */}
          {activeSection === 'pools' && (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-yellow-400 font-bold mb-5 flex items-center gap-2">
                <Users2 className="h-3.5 w-3.5" /> Pools — {label}
              </h2>
              {catPools.length === 0 ? (
                <div className="text-center py-16">
                  <Users2 className="h-10 w-10 text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-400">No pools created for this category yet</p>
                </div>
              ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {catPools.map(pool => (
                    <PoolStandings
                      key={pool.id}
                      pool={pool}
                      teams={teams}
                      participants={participants}
                      isTeamCat={isCatTeam}
                    />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-white/5 mt-12 py-6 px-6 text-center">
          <p className="text-slate-500 text-xs">{tournament?.name} · {label}</p>
        </div>
      </div>
    </PublicLayout>
  );
}
