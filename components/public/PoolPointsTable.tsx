'use client';

import type { Match, Pool, Registration, Team } from '@/types';
import { TeamLogo } from '@/components/TeamLogo';
import {
  computePoolStandings,
  type PoolStandingRow,
} from '@/lib/poolStandings';

interface Props {
  pool: Pool;
  matches: Match[];
  isTeamCat: boolean;
  teams: Team[];
  participants: Registration[];
  isDoubles?: boolean;
}

function entityLabel(isTeamCat: boolean, isDoubles?: boolean) {
  if (isTeamCat) return 'Team';
  if (isDoubles) return 'Pair';
  return 'Player';
}

function formatDiff(value: number): string {
  return value > 0 ? `+${value}` : String(value);
}

const stickyCell =
  'sticky left-0 z-10 bg-slate-900 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-white/10';
const stickyCellSecond =
  'sticky left-8 z-10 bg-slate-900 after:absolute after:right-0 after:top-0 after:bottom-0 after:w-px after:bg-white/10';

function PoolPointsTableInner({
  rows, label, isTeamCat, teams,
}: {
  rows: PoolStandingRow[];
  label: string;
  isTeamCat: boolean;
  teams: Team[];
}) {
  if (rows.every(r => r.played === 0)) {
    return (
      <p className="text-sm text-slate-500 italic px-5 py-6 text-center">
        No completed matches yet — standings will appear here after results are entered.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto -mx-1 px-1 scrollbar-hide">
      <table className="w-full min-w-[520px] text-[10px] sm:text-sm">
        <thead>
          <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[9px] sm:text-[10px]">
            <th className={`text-left font-bold px-1.5 sm:px-4 py-2 sm:py-2.5 w-8 ${stickyCell}`}>#</th>
            <th className={`text-left font-bold px-1.5 sm:px-2 py-2 sm:py-2.5 min-w-[88px] max-w-[120px] sm:max-w-none ${stickyCellSecond}`}>
              {label}
            </th>
            <th className="text-center font-bold px-1 sm:px-2 py-2 sm:py-2.5 w-9" title="Matches played">MP</th>
            <th className="text-center font-bold px-1 sm:px-2 py-2 sm:py-2.5 w-8 text-green-400" title="Won">W</th>
            <th className="text-center font-bold px-1 sm:px-2 py-2 sm:py-2.5 w-8 text-red-400" title="Lost">L</th>
            <th className="text-center font-bold px-1 sm:px-2 py-2 sm:py-2.5 w-8" title="Games won">GW</th>
            <th className="text-center font-bold px-1 sm:px-2 py-2 sm:py-2.5 w-8" title="Games lost">GL</th>
            <th className="text-center font-bold px-1 sm:px-2 py-2 sm:py-2.5 w-10" title="Points given (conceded)">PG</th>
            <th className="text-center font-bold px-1 sm:px-2 py-2 sm:py-2.5 w-10" title="Points taken (scored)">PT</th>
            <th className="text-center font-bold px-1 sm:px-2 py-2 sm:py-2.5 w-10" title="Point difference (PT − PG)">PD</th>
            <th className="text-center font-bold px-1.5 sm:px-4 py-2 sm:py-2.5 w-9 text-amber-400" title="Standings points (2 per win)">PTS</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row, idx) => {
            const isLeader = idx === 0 && row.played > 0;
            const rowBg = isLeader ? 'bg-yellow-400/5' : 'bg-slate-900';
            return (
              <tr key={row.id} className={isLeader ? 'bg-yellow-400/5' : ''}>
                <td className={`px-1.5 sm:px-4 py-2 sm:py-2.5 text-slate-500 font-bold tabular-nums ${stickyCell} ${rowBg}`}>
                  {idx + 1}
                </td>
                <td className={`px-1.5 sm:px-2 py-2 sm:py-2.5 font-semibold text-white min-w-[88px] max-w-[120px] sm:max-w-none ${stickyCellSecond} ${rowBg}`}>
                  <div className="flex items-center gap-2 min-w-0">
                    {isTeamCat && (
                      <TeamLogo
                        logoUrl={teams.find(t => t.id === row.id)?.logoUrl}
                        name={row.name}
                        size={24}
                      />
                    )}
                    <span className="truncate">{row.name}</span>
                  </div>
                </td>
                <td className="px-1 sm:px-2 py-2 sm:py-2.5 text-center text-slate-300 tabular-nums">{row.played}</td>
                <td className="px-1 sm:px-2 py-2 sm:py-2.5 text-center font-semibold text-green-400 tabular-nums">{row.won}</td>
                <td className="px-1 sm:px-2 py-2 sm:py-2.5 text-center font-semibold text-red-400 tabular-nums">{row.lost}</td>
                <td className="px-1 sm:px-2 py-2 sm:py-2.5 text-center text-purple-400 tabular-nums">{row.gamesWon}</td>
                <td className="px-1 sm:px-2 py-2 sm:py-2.5 text-center text-orange-400 tabular-nums">{row.gamesLost}</td>
                <td className="px-1 sm:px-2 py-2 sm:py-2.5 text-center text-slate-400 tabular-nums">{row.pointsAgainst}</td>
                <td className="px-1 sm:px-2 py-2 sm:py-2.5 text-center text-slate-400 tabular-nums">{row.pointsFor}</td>
                <td className={`px-1 sm:px-2 py-2 sm:py-2.5 text-center font-semibold tabular-nums ${row.pointDifference >= 0 ? 'text-sky-400' : 'text-red-400'}`}>
                  {formatDiff(row.pointDifference)}
                </td>
                <td className="px-1.5 sm:px-4 py-2 sm:py-2.5 text-center font-bold text-amber-400 tabular-nums">{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function PoolPointsTable({
  pool, matches, isTeamCat, teams, participants, isDoubles,
}: Props) {
  const nameLookup = (id: string) => {
    if (isTeamCat) return teams.find(t => t.id === id)?.name ?? `Team ${id.slice(0, 6)}`;
    const p = participants.find(r => r.id === id);
    if (!p) return `Player ${id.slice(0, 6)}`;
    return isDoubles && p.partnerName ? `${p.name} & ${p.partnerName}` : p.name;
  };

  const rows = computePoolStandings(pool, matches, {
    isTeamCat,
    teams,
    nameLookup,
  });

  return (
    <div className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600/20 to-indigo-500/10 px-4 sm:px-5 py-3 border-b border-white/5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-black text-white truncate">{pool.name}</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Points table · {pool.teams.length} {isTeamCat ? 'teams' : isDoubles ? 'pairs' : 'players'}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${pool.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
          {pool.status}
        </span>
      </div>
      <PoolPointsTableInner rows={rows} label={entityLabel(isTeamCat, isDoubles)} isTeamCat={isTeamCat} teams={teams} />
    </div>
  );
}
