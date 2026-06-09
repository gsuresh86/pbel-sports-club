'use client';

import type { Match, Pool, Registration, Team } from '@/types';
import {
  computePoolStandings,
  formatNrr,
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

function PoolPointsTableInner({ rows, label }: { rows: PoolStandingRow[]; label: string }) {
  if (rows.every(r => r.played === 0)) {
    return (
      <p className="text-sm text-slate-500 italic px-5 py-6 text-center">
        No completed matches yet — standings will appear here after results are entered.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <thead>
          <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
            <th className="text-left font-bold px-4 py-2.5 w-8">#</th>
            <th className="text-left font-bold px-2 py-2.5">{label}</th>
            <th className="text-center font-bold px-2 py-2.5 w-10" title="Played">P</th>
            <th className="text-center font-bold px-2 py-2.5 w-10 text-green-400" title="Won">W</th>
            <th className="text-center font-bold px-2 py-2.5 w-10 text-red-400" title="Lost">L</th>
            <th className="text-center font-bold px-2 py-2.5 w-10 text-amber-400" title="Points">Pts</th>
            <th className="text-center font-bold px-2 py-2.5 w-12 hidden sm:table-cell" title="Points for">PF</th>
            <th className="text-center font-bold px-2 py-2.5 w-12 hidden sm:table-cell" title="Points against">PA</th>
            <th className="text-center font-bold px-4 py-2.5 w-14 text-sky-400" title="Net run rate (points for ÷ points against)">NRR</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {rows.map((row, idx) => (
            <tr key={row.id} className={idx === 0 && row.played > 0 ? 'bg-yellow-400/5' : ''}>
              <td className="px-4 py-2.5 text-slate-500 font-bold">{idx + 1}</td>
              <td className="px-2 py-2.5 font-semibold text-white truncate max-w-[140px] sm:max-w-none">{row.name}</td>
              <td className="px-2 py-2.5 text-center text-slate-300">{row.played}</td>
              <td className="px-2 py-2.5 text-center font-semibold text-green-400">{row.won}</td>
              <td className="px-2 py-2.5 text-center font-semibold text-red-400">{row.lost}</td>
              <td className="px-2 py-2.5 text-center font-bold text-amber-400">{row.points}</td>
              <td className="px-2 py-2.5 text-center text-slate-400 hidden sm:table-cell">{row.pointsFor}</td>
              <td className="px-2 py-2.5 text-center text-slate-400 hidden sm:table-cell">{row.pointsAgainst}</td>
              <td className={`px-4 py-2.5 text-center font-semibold ${row.nrr >= 1 ? 'text-sky-400' : 'text-slate-400'}`}>
                {formatNrr(row.nrr)}
              </td>
            </tr>
          ))}
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
      <div className="bg-gradient-to-r from-purple-600/20 to-indigo-500/10 px-5 py-3 border-b border-white/5 flex items-center justify-between gap-3">
        <div>
          <h4 className="font-black text-white">{pool.name}</h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Points table · {pool.teams.length} {isTeamCat ? 'teams' : isDoubles ? 'pairs' : 'players'}
          </p>
        </div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase shrink-0 ${pool.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-400'}`}>
          {pool.status}
        </span>
      </div>
      <PoolPointsTableInner rows={rows} label={entityLabel(isTeamCat, isDoubles)} />
    </div>
  );
}
