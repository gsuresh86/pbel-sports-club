'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ExternalLink, Play, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getDisplaySides } from '@/lib/match-scoring';
import { publicTournamentPath } from '@/lib/tournament-banner';
import { ShuttlecockIcon } from '@/components/icons/ShuttlecockIcon';
import { TeamLogo } from '@/components/TeamLogo';
import {
  MatchWinCelebration,
  resolveWinnerDisplaySide,
} from '@/components/scoring/MatchWinCelebration';

function formatScore(score: number) {
  return score.toString().padStart(2, '0');
}

export interface ScoreboardDisplayProps {
  tournamentName: string;
  tournamentId?: string | null;
  round: string;
  matchNumber: number;
  player1Name: string;
  player2Name: string;
  player1Score: number;
  player2Score: number;
  player1Sets: number;
  player2Sets: number;
  currentSet: number;
  isLive: boolean;
  winner?: string;
  court?: string;
  sidesSwapped?: boolean;
  /** Side that won the last point — drives the serving-side indicator. */
  lastPointWonBy?: 'player1' | 'player2' | null;
  bannerUrl?: string;
  /** When this match is part of a team tie, show the team names and rubber tally. */
  teamMatch?: {
    team1Name: string;
    team2Name: string;
    team1LogoUrl?: string | null;
    team2LogoUrl?: string | null;
    team1Wins: number;
    team2Wins: number;
  } | null;
  className?: string;
}

export function ScoreboardDisplay({
  tournamentName,
  tournamentId,
  round,
  matchNumber,
  player1Name,
  player2Name,
  player1Score,
  player2Score,
  player1Sets,
  player2Sets,
  currentSet,
  isLive,
  winner,
  court,
  sidesSwapped = false,
  lastPointWonBy,
  bannerUrl,
  teamMatch,
  className,
}: ScoreboardDisplayProps) {
  const sides = getDisplaySides(
    { player1Name, player2Name },
    { p1: player1Score, p2: player2Score, sets1: player1Sets, sets2: player2Sets },
    sidesSwapped,
    lastPointWonBy
  );
  const showServing = isLive && !winner;

  const prevLeft = useRef(sides.left.score);
  const prevRight = useRef(sides.right.score);
  const leftBump = sides.left.score !== prevLeft.current;
  const rightBump = sides.right.score !== prevRight.current;

  useEffect(() => {
    prevLeft.current = sides.left.score;
    prevRight.current = sides.right.score;
  }, [sides.left.score, sides.right.score]);

  const leftBg = sides.left.color === 'blue' ? 'bg-blue-950/55' : 'bg-red-950/55';
  const rightBg = sides.right.color === 'blue' ? 'bg-blue-950/55' : 'bg-red-950/55';
  const leftText = sides.left.color === 'blue' ? 'text-blue-200' : 'text-red-200';
  const rightText = sides.right.color === 'blue' ? 'text-blue-200' : 'text-red-200';
  const leftScoreText = 'text-white';
  const rightScoreText = 'text-white';
  const leftTeamLogo = teamMatch
    ? (sidesSwapped ? teamMatch.team2LogoUrl : teamMatch.team1LogoUrl)
    : null;
  const rightTeamLogo = teamMatch
    ? (sidesSwapped ? teamMatch.team1LogoUrl : teamMatch.team2LogoUrl)
    : null;
  const leftTeamName = teamMatch
    ? (sidesSwapped ? teamMatch.team2Name : teamMatch.team1Name)
    : sides.left.name;
  const rightTeamName = teamMatch
    ? (sidesSwapped ? teamMatch.team1Name : teamMatch.team2Name)
    : sides.right.name;

  const winnerSide = resolveWinnerDisplaySide(
    winner,
    sides.left.name,
    sides.right.name,
    player1Sets,
    player2Sets,
    sidesSwapped,
  );
  const [celebrating, setCelebrating] = useState(false);
  const leftWon = winnerSide === 'left';
  const rightWon = winnerSide === 'right';
  const loserName =
    winnerSide === 'left'
      ? sides.right.name
      : winnerSide === 'right'
        ? sides.left.name
        : null;

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
          {tournamentId ? (
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
          ) : (
            <h1 className="text-xl sm:text-3xl lg:text-4xl font-bold truncate drop-shadow-md">
              {tournamentName}
            </h1>
          )}
          <p className="text-base sm:text-xl lg:text-2xl text-zinc-300 truncate drop-shadow-sm">
            {round} · Match #{matchNumber}
            {court ? ` · Court ${court}` : ''}
          </p>
        </div>
        <div className="shrink-0 flex items-center gap-3">
          {!winner && (
            <div className="text-right hidden sm:block">
              <div className="text-base sm:text-lg text-zinc-400">Set</div>
              <div className="text-3xl sm:text-4xl font-bold tabular-nums">{currentSet}</div>
            </div>
          )}
          {isLive && !winner ? (
            <div className="flex items-center gap-2 bg-red-600/20 text-red-400 px-3 py-1.5 rounded-full border border-red-500/30">
              <Play className="h-4 w-4 animate-pulse" />
              <span className="font-semibold text-sm sm:text-base">LIVE</span>
            </div>
          ) : (
            <div className="text-right max-w-[40vw] sm:max-w-none">
              <div className="text-xs sm:text-sm uppercase tracking-widest text-zinc-500">Round</div>
              <div className="text-lg sm:text-2xl lg:text-3xl font-bold text-zinc-200 truncate">
                {round}
              </div>
            </div>
          )}
        </div>
      </header>

      {winner && (
        <div className="relative shrink-0 py-5 sm:py-8 text-center bg-yellow-950/35 backdrop-blur-sm border-b border-yellow-800/40">
          <p className="text-3xl sm:text-5xl lg:text-6xl font-bold text-yellow-400 flex items-center justify-center gap-4 px-4">
            <Trophy className="h-10 w-10 sm:h-14 sm:w-14 lg:h-16 lg:w-16 shrink-0 animate-bounce" />
            <span>Congratulations, {winner}!</span>
          </p>
        </div>
      )}

      <div className="relative flex-1 grid grid-cols-2 min-h-0 bg-black/40">
        <div className={cn('relative flex flex-col items-center justify-center border-r border-zinc-800/80 backdrop-blur-sm p-4 overflow-hidden', leftBg)}>
          {leftWon && celebrating && (
            <div className="match-win-side-flash absolute inset-0 bg-gradient-to-t from-yellow-400/30 via-amber-300/10 to-transparent" />
          )}
          {leftTeamLogo && (
            <div className="absolute bottom-3 left-3 sm:bottom-6 sm:left-6 pointer-events-none">
              <TeamLogo
                logoUrl={leftTeamLogo}
                name={leftTeamName}
                circular={false}
                className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48"
              />
            </div>
          )}
          <h2 className={cn('text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-center truncate max-w-full px-2 mb-4 sm:mb-10', leftText)}>
            {sides.left.name}
          </h2>
          <div
            className={cn(
              'relative z-10 text-[clamp(7rem,28vw,28rem)] font-bold tabular-nums leading-none antialiased transition-transform duration-200',
              leftScoreText,
              leftBump && !celebrating && 'scale-110',
              leftWon && celebrating && 'match-win-score-pop scale-110'
            )}
          >
            {formatScore(sides.left.score)}
          </div>
          <div className="h-12 sm:h-24 lg:h-32 mt-3 sm:mt-6 flex items-center justify-center" aria-hidden={!(showServing && sides.left.serving)}>
            {showServing && sides.left.serving && (
              <ShuttlecockIcon className="h-10 w-10 sm:h-20 sm:w-20 lg:h-28 lg:w-28 text-white animate-pulse drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]" title="Serving" />
            )}
          </div>
          {sides.left.sets > 0 && (
            <div className="mt-4 sm:mt-6 text-zinc-400 text-xl sm:text-3xl lg:text-4xl">
              Sets <span className="text-white font-bold tabular-nums">{sides.left.sets}</span>
            </div>
          )}
        </div>

        <div className={cn('relative flex flex-col items-center justify-center backdrop-blur-sm p-4 overflow-hidden', rightBg)}>
          {rightWon && celebrating && (
            <div className="match-win-side-flash absolute inset-0 bg-gradient-to-t from-yellow-400/30 via-amber-300/10 to-transparent" />
          )}
          {rightTeamLogo && (
            <div className="absolute bottom-3 right-3 sm:bottom-6 sm:right-6 pointer-events-none">
              <TeamLogo
                logoUrl={rightTeamLogo}
                name={rightTeamName}
                circular={false}
                className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48"
              />
            </div>
          )}
          <h2 className={cn('text-2xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold text-center truncate max-w-full px-2 mb-4 sm:mb-10', rightText)}>
            {sides.right.name}
          </h2>
          <div
            className={cn(
              'relative z-10 text-[clamp(7rem,28vw,28rem)] font-bold tabular-nums leading-none antialiased transition-transform duration-200',
              rightScoreText,
              rightBump && !celebrating && 'scale-110',
              rightWon && celebrating && 'match-win-score-pop scale-110'
            )}
          >
            {formatScore(sides.right.score)}
          </div>
          <div className="h-12 sm:h-24 lg:h-32 mt-3 sm:mt-6 flex items-center justify-center" aria-hidden={!(showServing && sides.right.serving)}>
            {showServing && sides.right.serving && (
              <ShuttlecockIcon className="h-10 w-10 sm:h-20 sm:w-20 lg:h-28 lg:w-28 text-white animate-pulse drop-shadow-[0_2px_12px_rgba(0,0,0,0.85)]" title="Serving" />
            )}
          </div>
          {sides.right.sets > 0 && (
            <div className="mt-4 sm:mt-6 text-zinc-400 text-xl sm:text-3xl lg:text-4xl">
              Sets <span className="text-white font-bold tabular-nums">{sides.right.sets}</span>
            </div>
          )}
        </div>
      </div>

      <footer className="relative shrink-0 py-4 sm:py-6 text-center bg-zinc-950/75 backdrop-blur-md border-t border-zinc-800/80">
        {winner ? (
          loserName ? (
            <p className="text-xl sm:text-3xl lg:text-4xl font-semibold text-zinc-300 px-4">
              Great effort, <span className="text-white">{loserName}</span> — well played!
            </p>
          ) : (
            <p className="text-xl sm:text-3xl lg:text-4xl font-semibold text-zinc-300 px-4">
              Match complete
            </p>
          )
        ) : teamMatch ? (
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs sm:text-sm uppercase tracking-widest text-zinc-400">
              Team Tie · Rubbers won
            </span>
            <div className="flex items-center justify-center gap-3 sm:gap-6">
              <span className="text-xl sm:text-3xl lg:text-4xl font-semibold text-blue-300 truncate max-w-[34vw]">
                {teamMatch.team1Name}
              </span>
              <span className="text-2xl sm:text-4xl lg:text-5xl font-bold tabular-nums text-white">
                {teamMatch.team1Wins} <span className="text-zinc-500">–</span> {teamMatch.team2Wins}
              </span>
              <span className="text-xl sm:text-3xl lg:text-4xl font-semibold text-red-300 truncate max-w-[34vw]">
                {teamMatch.team2Name}
              </span>
            </div>
          </div>
        ) : isLive ? (
          <p className="text-zinc-400 text-lg sm:text-2xl lg:text-3xl">
            Set {currentSet} · Match in progress
          </p>
        ) : (
          <p className="text-zinc-500 text-lg sm:text-2xl lg:text-3xl">Match not started</p>
        )}
      </footer>
      <MatchWinCelebration
        winner={winner}
        winnerSide={winnerSide}
        onCelebratingChange={setCelebrating}
      />
      </div>
    </div>
  );
}
