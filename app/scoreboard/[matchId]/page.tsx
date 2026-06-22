'use client';

import { Suspense, useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import {
  collection,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import {
  findMatchById,
  tournamentLiveScoreRef,
  tournamentMatchRef,
} from '@/lib/firestore-paths';
import { ScoreboardDisplay } from '@/components/scoring/ScoreboardDisplay';
import { TeamTieScoreboardDisplay } from '@/components/scoring/TeamTieScoreboardDisplay';
import { resolveTournamentBannerUrl } from '@/lib/tournament-banner';
import { fetchTournamentRegistrations, fetchTournamentTeams, toTournament } from '@/lib/tournament-api';
import { countRubbersWon } from '@/lib/teamMatchRubbers';
import { getMatchLiveDisplayNames, resolveMatchWinnerDisplayName } from '@/lib/utils';
import { Match, Tournament, LiveScore, Registration, Team } from '@/types';

function ScoreboardLoading() {
  return (
    <div className="h-dvh w-full flex items-center justify-center bg-zinc-950">
      <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-white" />
    </div>
  );
}

function ScoreboardPageInner() {
  const params = useParams();
  const searchParams = useSearchParams();
  const matchId = params.matchId as string;
  const queryTournamentId =
    searchParams.get('tournamentId')?.trim() ||
    searchParams.get('tournament')?.trim() ||
    null;

  const [match, setMatch] = useState<Match | null>(null);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [liveScore, setLiveScore] = useState<LiveScore | null>(null);
  const [matchLoading, setMatchLoading] = useState(true);
  const [liveScoreReady, setLiveScoreReady] = useState(false);
  const [tournamentLoading, setTournamentLoading] = useState(true);
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [parentTeamMatch, setParentTeamMatch] = useState<Match | null>(null);
  const [teamRubbers, setTeamRubbers] = useState<Match[]>([]);
  const [rubberLiveScores, setRubberLiveScores] = useState<Map<string, LiveScore>>(new Map());

  const effectiveTournamentId = useMemo(
    () =>
      queryTournamentId ||
      match?.tournamentId?.trim() ||
      liveScore?.tournamentId?.trim() ||
      null,
    [queryTournamentId, match?.tournamentId, liveScore?.tournamentId]
  );

  useEffect(() => {
    if (!matchId) return;

    let matchUnsub: (() => void) | undefined;
    let liveUnsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      const resolved = await findMatchById(matchId, queryTournamentId);
      if (cancelled) return;

      if (!resolved) {
        setMatch(null);
        setMatchLoading(false);
        return;
      }

      const tid = resolved.tournamentId;
      matchUnsub = onSnapshot(tournamentMatchRef(tid, matchId), (matchDoc) => {
        if (!matchDoc.exists()) {
          setMatch(null);
          setMatchLoading(false);
          return;
        }
        const matchData = matchDoc.data();
        setMatch({
          id: matchDoc.id,
          ...matchData,
          scheduledTime: matchData.scheduledTime?.toDate(),
          actualStartTime: matchData.actualStartTime?.toDate(),
          actualEndTime: matchData.actualEndTime?.toDate(),
          updatedAt: matchData.updatedAt?.toDate(),
        } as Match);
        setMatchLoading(false);
      });

      liveUnsub = onSnapshot(tournamentLiveScoreRef(tid, matchId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setLiveScore({
            ...data,
            lastUpdated: data.lastUpdated?.toDate(),
            matchCompletedAt: data.matchCompletedAt?.toDate(),
          } as LiveScore);
        } else {
          setLiveScore(null);
        }
        setLiveScoreReady(true);
      });
    })();

    return () => {
      cancelled = true;
      matchUnsub?.();
      liveUnsub?.();
    };
  }, [matchId, queryTournamentId]);

  useEffect(() => {
    if (!effectiveTournamentId) {
      setTournament(null);
      setTournamentLoading(false);
      return;
    }

    let cancelled = false;
    setTournamentLoading(true);

    const applyTournament = (data: Record<string, unknown>, id: string) => {
      if (!cancelled) {
        setTournament(toTournament(data, id));
        setTournamentLoading(false);
      }
    };

    const tournamentRef = doc(db, 'tournaments', effectiveTournamentId);

    (async () => {
      try {
        const serverSnap = await getDocFromServer(tournamentRef);
        if (serverSnap.exists()) {
          applyTournament(serverSnap.data(), serverSnap.id);
        } else if (!cancelled) {
          setTournament(null);
          setTournamentLoading(false);
        }
      } catch {
        const cacheSnap = await getDoc(tournamentRef);
        if (cacheSnap.exists()) {
          applyTournament(cacheSnap.data(), cacheSnap.id);
        } else if (!cancelled) {
          setTournament(null);
          setTournamentLoading(false);
        }
      }
    })();

    const tournamentUnsub = onSnapshot(tournamentRef, (tournamentDoc) => {
      if (tournamentDoc.exists()) {
        applyTournament(tournamentDoc.data(), tournamentDoc.id);
      } else if (!cancelled) {
        setTournament(null);
        setTournamentLoading(false);
      }
    });

    return () => {
      cancelled = true;
      tournamentUnsub();
    };
  }, [effectiveTournamentId]);

  useEffect(() => {
    if (!effectiveTournamentId) {
      setRegistrations([]);
      setTeams([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const [regs, tournamentTeams] = await Promise.all([
          fetchTournamentRegistrations(effectiveTournamentId),
          fetchTournamentTeams(effectiveTournamentId),
        ]);
        if (cancelled) return;
        setRegistrations(regs);
        setTeams(tournamentTeams);
      } catch {
        if (!cancelled) {
          setRegistrations([]);
          setTeams([]);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveTournamentId]);

  useEffect(() => {
    if (match) {
      const regById = new Map(registrations.map(r => [r.id, r]));
      if (match.matchKind === 'team-tie') {
        document.title = `${match.player1Name} vs ${match.player2Name} | Team Tie Scoreboard`;
      } else {
        const names = getMatchLiveDisplayNames(match, regById);
        document.title = `${names.player1Name} vs ${names.player2Name} | Live Scoreboard`;
      }
    }
  }, [match, registrations]);

  // The team-tie match whose rubbers determine the tie score: the match itself
  // when it's the tie, or the parent when this match is a rubber.
  const teamTieParentId = useMemo(() => {
    if (!match) return null;
    if (match.matchKind === 'team-tie') return match.id;
    if (match.matchKind === 'rubber' || match.parentMatchId) return match.parentMatchId ?? null;
    return null;
  }, [match]);

  // When viewing a rubber, watch the parent tie match to get the team names.
  useEffect(() => {
    const parentId = match?.parentMatchId;
    if (!parentId || !effectiveTournamentId) {
      setParentTeamMatch(null);
      return;
    }
    const unsub = onSnapshot(
      tournamentMatchRef(effectiveTournamentId, parentId),
      (snap) => {
        setParentTeamMatch(snap.exists() ? ({ id: snap.id, ...snap.data() } as Match) : null);
      }
    );
    return () => unsub();
  }, [match?.parentMatchId, effectiveTournamentId]);

  // Watch all rubbers in the tie to compute the live rubber tally.
  useEffect(() => {
    if (!teamTieParentId || !effectiveTournamentId) {
      setTeamRubbers([]);
      return;
    }
    const rubbersQuery = query(
      collection(db, 'tournaments', effectiveTournamentId, 'matches'),
      where('parentMatchId', '==', teamTieParentId)
    );
    const unsub = onSnapshot(rubbersQuery, (snap) => {
      setTeamRubbers(
        snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              ...data,
              scheduledTime: data.scheduledTime?.toDate?.(),
              actualStartTime: data.actualStartTime?.toDate?.(),
              actualEndTime: data.actualEndTime?.toDate?.(),
              updatedAt: data.updatedAt?.toDate?.(),
            } as Match;
          })
          .sort((a, b) => (a.rubberNumber ?? 0) - (b.rubberNumber ?? 0))
      );
    });
    return () => unsub();
  }, [teamTieParentId, effectiveTournamentId]);

  const rubberIdsKey = teamRubbers.map((r) => r.id).join(',');

  useEffect(() => {
    if (!effectiveTournamentId || !rubberIdsKey) {
      setRubberLiveScores(new Map());
      return;
    }

    const rubberIds = rubberIdsKey.split(',');
    const unsubs = rubberIds.map((rubberId) =>
      onSnapshot(tournamentLiveScoreRef(effectiveTournamentId, rubberId), (docSnap) => {
        setRubberLiveScores((prev) => {
          const next = new Map(prev);
          if (docSnap.exists()) {
            const data = docSnap.data();
            next.set(rubberId, {
              ...data,
              lastUpdated: data.lastUpdated?.toDate(),
              matchCompletedAt: data.matchCompletedAt?.toDate(),
            } as LiveScore);
          } else {
            next.delete(rubberId);
          }
          return next;
        });
      })
    );

    return () => unsubs.forEach((unsub) => unsub());
  }, [effectiveTournamentId, rubberIdsKey]);

  const teamMatchStats = useMemo(() => {
    if (!teamTieParentId) return null;
    const tie = match?.matchKind === 'team-tie' ? match : parentTeamMatch;
    if (!tie) return null;
    const wins = countRubbersWon(teamRubbers, rubberLiveScores);
    const teamsById = new Map(teams.map((t) => [t.id, t]));
    const team1 = tie.team1Id ? teamsById.get(tie.team1Id) : undefined;
    const team2 = tie.team2Id ? teamsById.get(tie.team2Id) : undefined;
    return {
      team1Name: tie.player1Name,
      team2Name: tie.player2Name,
      team1LogoUrl: team1?.logoUrl,
      team2LogoUrl: team2?.logoUrl,
      team1Wins: wins.team1,
      team2Wins: wins.team2,
    };
  }, [teamTieParentId, match, parentTeamMatch, teamRubbers, rubberLiveScores, teams]);

  const regById = useMemo(() => new Map(registrations.map(r => [r.id, r])), [registrations]);
  const matchDisplayNames = match ? getMatchLiveDisplayNames(match, regById) : null;

  const waitingForTournamentId =
    !matchLoading && match !== null && !effectiveTournamentId && !liveScoreReady;
  const waitingForTournamentDoc = !!effectiveTournamentId && tournamentLoading;
  const loading = matchLoading || waitingForTournamentId || waitingForTournamentDoc;

  if (loading) {
    return <ScoreboardLoading />;
  }

  if (!match) {
    return (
      <div className="h-dvh w-full flex items-center justify-center bg-zinc-950 text-white">
        <p className="text-2xl">Match not found</p>
      </div>
    );
  }

  const isLive = liveScore?.isLive ?? match.status === 'live';
  const player1Score =
    liveScore?.player1CurrentScore ??
    match.sets?.[match.sets.length - 1]?.player1Score ??
    0;
  const player2Score =
    liveScore?.player2CurrentScore ??
    match.sets?.[match.sets.length - 1]?.player2Score ??
    0;
  const player1Sets = liveScore?.player1Sets ?? match.player1Score ?? 0;
  const player2Sets = liveScore?.player2Sets ?? match.player2Score ?? 0;
  const currentSet = liveScore?.currentSet ?? (match.sets?.length || 0) + 1;
  const winnerRaw =
    liveScore?.winnerName ??
    (match.status === 'completed' ? match.winner : undefined);
  const winnerDisplayName = resolveMatchWinnerDisplayName(match, winnerRaw, regById);

  const bannerUrl = resolveTournamentBannerUrl(tournament);
  const player1DisplayName = matchDisplayNames?.player1Name ?? match.player1Name;
  const player2DisplayName = matchDisplayNames?.player2Name ?? match.player2Name;

  if (match.matchKind === 'team-tie' && teamMatchStats) {
    return (
      <TeamTieScoreboardDisplay
        tournamentName={tournament?.name ?? 'Tournament'}
        tournamentId={effectiveTournamentId ?? match.tournamentId}
        bannerUrl={bannerUrl}
        round={match.round}
        matchNumber={match.matchNumber}
        team1Name={teamMatchStats.team1Name}
        team2Name={teamMatchStats.team2Name}
        team1LogoUrl={teamMatchStats.team1LogoUrl}
        team2LogoUrl={teamMatchStats.team2LogoUrl}
        team1Wins={teamMatchStats.team1Wins}
        team2Wins={teamMatchStats.team2Wins}
        rubbers={teamRubbers}
        regById={regById}
        rubberLiveScores={rubberLiveScores}
        court={match.court}
      />
    );
  }

  return (
    <ScoreboardDisplay
      tournamentName={tournament?.name ?? 'Tournament'}
      tournamentId={effectiveTournamentId ?? match.tournamentId}
      bannerUrl={bannerUrl}
      round={match.round}
      matchNumber={match.matchNumber}
      player1Name={player1DisplayName}
      player2Name={player2DisplayName}
      player1Score={isLive && liveScore ? liveScore.player1CurrentScore : player1Score}
      player2Score={isLive && liveScore ? liveScore.player2CurrentScore : player2Score}
      player1Sets={isLive && liveScore ? liveScore.player1Sets : player1Sets}
      player2Sets={isLive && liveScore ? liveScore.player2Sets : player2Sets}
      currentSet={currentSet}
      isLive={isLive && !winnerDisplayName}
      winner={winnerDisplayName}
      court={match.court}
      sidesSwapped={liveScore?.sidesSwapped ?? false}
      lastPointWonBy={liveScore?.lastPointWonBy}
      teamMatch={teamMatchStats}
    />
  );
}

export default function ScoreboardPage() {
  return (
    <Suspense fallback={<ScoreboardLoading />}>
      <ScoreboardPageInner />
    </Suspense>
  );
}
