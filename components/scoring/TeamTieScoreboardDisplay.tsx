'use client';

import Link from 'next/link';
import { ExternalLink, Play, Trophy } from 'lucide-react';
import { cn, formatMatchSideLabel } from '@/lib/utils';
import { rubberTypeLabel, rubberWinnerSide, rubberScoreLine } from '@/lib/teamMatchRubbers';
import { publicTournamentPath, scoreboardPath } from '@/lib/tournament-banner';
import { ShuttlecockIcon } from '@/components/icons/ShuttlecockIcon';
import { TeamLogo } from '@/components/TeamLogo';
import type { LiveScore, Match, Registration } from '@/types';

export interface TeamTieScoreboardDisplayProps {
  tournamentName: string;
  tournamentId: string;
  round: string;
  matchNumber: number | string;
  team1Name: string;
  team2Name: string;
  team1LogoUrl?: string | null;
  team2LogoUrl?: string | null;
  team1Wins: number;
  team2Wins: number;
  rubbers: Match[];
  regById: Map<string, Registration>;
  rubberLiveScores: Map<string, LiveScore>;
  court?: string;
  bannerUrl?: string;
  className?: string;
}

export function TeamTieScoreboardDisplay({
  tournamentName,
  tournamentId,
  round,
  matchNumber,
  team1Name,
  team2Name,
  team1LogoUrl,
  team2LogoUrl,
  team1Wins,
  team2Wins,
  rubbers,
  regById,
  rubberLiveScores,
  court,
  bannerUrl,
  className,
}: TeamTieScoreboardDisplayProps) {
  const sortedRubbers = [...rubbers].sort((a, b) => (a.rubberNumber ?? 0) - (b.rubberNumber ?? 0));
  const anyLive = sortedRubbers.some(
    r => r.status === 'live' || rubberLiveScores.get(r.id)?.isLive
  );
  const tieComplete = team1Wins >= 3 || team2Wins >= 3;

  return (
    <div
      className={cn(
        'relative h-dvh w-full flex flex-col text-white overflow-hidden select-none',
        !bannerUrl && 'bg-zinc-950',
        className
      )}
    >
      {bannerUrl && (
        <div className="absolute inset-0 z-0" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            key={bannerUrl}
            src={bannerUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/65 via-zinc-950/75 to-zinc-950/85" />
          <div className="absolute inset-0 bg-black/25" />
        </div>
      )}

      <div className="relative z-10 flex flex-col h-full min-h-0">
        <header className="shrink-0 flex items-center justify-between gap-4 px-4 sm:px-8 py-3 sm:py-5 bg-zinc-950/75 backdrop-blur-md border-b border-zinc-800/80">
          <div className="min-w-0">
            <Link
              href={publicTournamentPath(tournamentId)}
              className="group inline-flex items-center gap-2 max-w-full hover:text-zinc-200 transition-colors"
              title="View public tournament page"
            >
              <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold truncate drop-shadow-md">
                {tournamentName}
              </h1>
              <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-zinc-400 group-hover:text-zinc-200" />
            </Link>
            <p className="text-base sm:text-xl lg:text-2xl text-zinc-300 truncate drop-shadow-sm">
              {round} · Match #{matchNumber}
              {court ? ` · Court ${court}` : ''}
            </p>
          </div>
          <div className="shrink-0">
            {tieComplete ? (
              <div className="flex items-center gap-2 bg-yellow-600/20 text-yellow-400 px-3 py-1.5 rounded-full border border-yellow-500/30">
                <Trophy className="h-4 w-4" />
                <span className="font-semibold text-sm sm:text-base">FINAL</span>
              </div>
            ) : anyLive ? (
              <div className="flex items-center gap-2 bg-red-600/20 text-red-400 px-3 py-1.5 rounded-full border border-red-500/30">
                <Play className="h-4 w-4 animate-pulse" />
                <span className="font-semibold text-sm sm:text-base">LIVE</span>
              </div>
            ) : null}
          </div>
        </header>

        <div className="shrink-0 py-4 sm:py-6 px-4 sm:px-8 bg-zinc-950/70 backdrop-blur-md border-b border-zinc-800/80">
          <p className="text-center text-xs sm:text-sm uppercase tracking-widest text-zinc-400 mb-2">
            Team Tie · Rubbers won
          </p>
          <div className="flex items-center justify-center gap-3 sm:gap-6 lg:gap-8">
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 max-w-[30vw] sm:max-w-none">
              <TeamLogo
                logoUrl={team1LogoUrl}
                name={team1Name}
                className="shrink-0 w-14 h-14 sm:w-20 sm:h-20 lg:w-28 lg:h-28"
              />
              <span className="text-xl sm:text-3xl lg:text-4xl font-semibold text-blue-300 truncate">
                {team1Name}
              </span>
            </div>
            <span className="text-3xl sm:text-5xl lg:text-6xl font-bold tabular-nums text-white shrink-0">
              {team1Wins}
              <span className="text-zinc-500 mx-2">–</span>
              {team2Wins}
            </span>
            <div className="flex items-center gap-2 sm:gap-4 min-w-0 max-w-[30vw] sm:max-w-none justify-end">
              <span className="text-xl sm:text-3xl lg:text-4xl font-semibold text-red-300 truncate">
                {team2Name}
              </span>
              <TeamLogo
                logoUrl={team2LogoUrl}
                name={team2Name}
                className="shrink-0 w-14 h-14 sm:w-20 sm:h-20 lg:w-28 lg:h-28"
              />
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 sm:px-6 py-3 sm:py-5">
          <p className="text-xs sm:text-sm font-bold uppercase tracking-widest text-zinc-500 mb-3 sm:mb-4 px-1">
            Games
          </p>

          {sortedRubbers.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-zinc-500 text-lg sm:text-2xl italic">
              Games not available yet
            </div>
          ) : (
            <div className="space-y-2 sm:space-y-3 max-w-5xl mx-auto">
              {sortedRubbers.map(rubber => {
                const liveScore = rubberLiveScores.get(rubber.id);
                const isLive = rubber.status === 'live' || (liveScore?.isLive && !liveScore.winnerName);
                const servingSide = isLive ? liveScore?.lastPointWonBy ?? null : null;
                const winner = rubberWinnerSide(rubber, liveScore);
                const isDone = winner !== null || rubber.status === 'completed' || !!liveScore?.winnerName;
                const side1 = formatMatchSideLabel(rubber, 1, regById);
                const side2 = formatMatchSideLabel(rubber, 2, regById);
                const scoreLine = rubberScoreLine(rubber, liveScore);
                const scoreboardHref = scoreboardPath(rubber.id, tournamentId);

                return (
                  <Link
                    key={rubber.id}
                    href={scoreboardHref}
                    aria-label={`Open live scoreboard for game ${rubber.rubberNumber}`}
                    className={cn(
                      'block rounded-xl sm:rounded-2xl border px-3 sm:px-5 py-3 sm:py-4 backdrop-blur-sm transition-colors',
                      'hover:bg-zinc-800/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40',
                      isLive
                        ? 'bg-red-950/60 border-red-500/40 ring-1 ring-red-500/30 hover:bg-red-950/70'
                        : isDone
                          ? 'bg-zinc-950/70 border-zinc-700/70'
                          : 'bg-zinc-950/60 border-zinc-800/70'
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
                      <span className="text-xs sm:text-sm font-bold text-zinc-400 uppercase tracking-wide">
                        Game {rubber.rubberNumber} · {rubberTypeLabel(rubber.rubberType ?? 'single')}
                      </span>
                      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        {isLive ? (
                          <span className="flex items-center gap-1.5 text-xs sm:text-sm font-bold text-red-400 uppercase">
                            <Play className="h-3 w-3 sm:h-4 sm:w-4 animate-pulse" />
                            Live
                          </span>
                        ) : isDone ? (
                          <span className="text-xs sm:text-sm font-bold text-green-400/90 uppercase">Done</span>
                        ) : (
                          <span className="text-xs sm:text-sm font-bold text-zinc-500 uppercase">
                            {rubber.status === 'scheduled' ? 'Upcoming' : rubber.status}
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-zinc-400 uppercase tracking-wide">
                          <ExternalLink className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                          <span className="hidden sm:inline">Scoreboard</span>
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4">
                      <span className="flex items-center gap-1.5 min-w-0">
                        <span
                          className={cn(
                            'truncate text-sm sm:text-xl lg:text-2xl font-medium',
                            winner === 1 ? 'text-yellow-300' : 'text-white'
                          )}
                          title={side1}
                        >
                          {side1}
                        </span>
                        {servingSide === 'player1' && (
                          <ShuttlecockIcon className="shrink-0 h-4 w-4 sm:h-7 sm:w-7 lg:h-9 lg:w-9 text-white" title="Serving" />
                        )}
                      </span>
                      <span className="font-black tabular-nums text-white whitespace-nowrap text-base sm:text-2xl lg:text-3xl px-1 sm:px-2">
                        {scoreLine}
                      </span>
                      <span className="flex items-center justify-end gap-1.5 min-w-0">
                        {servingSide === 'player2' && (
                          <ShuttlecockIcon className="shrink-0 h-4 w-4 sm:h-7 sm:w-7 lg:h-9 lg:w-9 text-white" title="Serving" />
                        )}
                        <span
                          className={cn(
                            'truncate text-sm sm:text-xl lg:text-2xl font-medium text-right',
                            winner === 2 ? 'text-yellow-300' : 'text-white'
                          )}
                          title={side2}
                        >
                          {side2}
                        </span>
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
