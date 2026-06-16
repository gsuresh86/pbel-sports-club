'use client';

import { useTournament, useTournamentMatches } from '@/hooks/use-tournament-queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy } from 'lucide-react';
import { Match } from '@/types';
import { useTournamentPageGate } from '@/hooks/use-tournament-page-gate';

export default function ResultsPage() {
  const { user, tournamentId, queriesEnabled } = useTournamentPageGate('results');

  const { data: tournamentData } = useTournament(tournamentId, { enabled: queriesEnabled });
  const { data: matchesData = [] } = useTournamentMatches(tournamentId, { enabled: queriesEnabled });

  const tournament = tournamentData ?? null;
  const matches = matchesData;

  if (!tournament) return null;

  const completed = matches.filter((m) => m.status === 'completed');
  type RowStat = { name: string; played: number; won: number; lost: number; pts: number; gw: number; gl: number; gd: number; pw: number; pl: number; pd: number };
  const groupToStats = new Map<string, Map<string, RowStat>>();
  const groupIsTeam = new Map<string, boolean>();

  const ensureStat = (round: string, name: string): RowStat => {
    if (!groupToStats.has(round)) groupToStats.set(round, new Map());
    const map = groupToStats.get(round)!;
    if (!map.has(name)) map.set(name, { name, played: 0, won: 0, lost: 0, pts: 0, gw: 0, gl: 0, gd: 0, pw: 0, pl: 0, pd: 0 });
    return map.get(name)!;
  };

  completed.forEach((m) => {
    const round = (m.round || 'Standings').trim() || 'Standings';
    const isTeamMatch = m.matchKind === 'team-tie' || m.matchKind === 'rubber' || !!m.team1Id;
    groupIsTeam.set(round, (groupIsTeam.get(round) ?? false) || isTeamMatch);
    const p1 = m.player1Name || 'TBD';
    const p2 = m.player2Name || 'TBD';
    const s1 = m.player1Score ?? 0;
    const s2 = m.player2Score ?? 0;
    const sets = (m as Match).sets || [];
    const p1Points = sets.reduce((sum, set) => sum + (set.player1Score ?? 0), 0);
    const p2Points = sets.reduce((sum, set) => sum + (set.player2Score ?? 0), 0);

    [p1, p2].forEach((name) => {
      const stat = ensureStat(round, name);
      stat.played += 1;
      if (name === p1) {
        stat.gw += s1; stat.gl += s2; stat.pw += p1Points; stat.pl += p2Points;
        if (m.winner === name) { stat.won += 1; stat.pts += 2; } else stat.lost += 1;
      } else {
        stat.gw += s2; stat.gl += s1; stat.pw += p2Points; stat.pl += p1Points;
        if (m.winner === name) { stat.won += 1; stat.pts += 2; } else stat.lost += 1;
      }
      stat.gd = stat.gw - stat.gl;
      stat.pd = stat.pw - stat.pl;
    });
  });

  const groups = Array.from(groupToStats.keys()).sort();
  const tournamentShort = tournament.name ? tournament.name.replace(/\s+/g, ' ').trim().slice(0, 6) : '';

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h3 className="text-base font-semibold sm:text-lg">Results</h3>
        <p className="text-xs text-gray-600 sm:text-sm">Group standings: rank by points, then set difference, then point difference</p>
      </div>

      {groups.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No results yet</h3>
            <p className="text-muted-foreground">Completed match results will show group standings here.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4 sm:space-y-6">
          {groups.map((round) => {
            const map = groupToStats.get(round)!;
            const isTeam = groupIsTeam.get(round) ?? false;
            const rows = Array.from(map.values()).sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.pd - a.pd);
            return (
              <Card key={round} className="rounded-none">
                <CardHeader className="p-4 pb-2 sm:p-6">
                  <CardTitle className="text-sm font-semibold sm:text-base">
                    {tournamentShort ? `${tournamentShort} - ${round}` : round}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <Table className="min-w-[520px]">
                      <TableHeader>
                        <TableRow className="bg-muted/60">
                          <TableHead className="font-semibold text-xs sm:text-sm">TEAM</TableHead>
                          {(isTeam ? ['MP', 'W', 'L', 'PTS', 'GW', 'GL', 'GD', 'PW', 'PL', 'PD'] : ['MP', 'W', 'L', 'PTS', 'PW', 'PL', 'PD']).map((h) => (
                            <TableHead key={h} className="text-center w-8 sm:w-12 font-semibold text-xs sm:text-sm">{h}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell className="font-medium text-primary text-xs sm:text-sm py-2">{row.name}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm py-2">{row.played}</TableCell>
                            <TableCell className="text-center font-semibold text-green-600 text-xs sm:text-sm py-2">{row.won}</TableCell>
                            <TableCell className="text-center font-semibold text-red-600 text-xs sm:text-sm py-2">{row.lost}</TableCell>
                            <TableCell className="text-center font-semibold text-amber-600 text-xs sm:text-sm py-2">{row.pts}</TableCell>
                            {isTeam && (
                              <>
                                <TableCell className="text-center text-purple-600 text-xs sm:text-sm py-2">{row.gw}</TableCell>
                                <TableCell className="text-center text-orange-600 text-xs sm:text-sm py-2">{row.gl}</TableCell>
                                <TableCell className="text-center text-xs sm:text-sm py-2">{row.gd >= 0 ? `+${row.gd}` : row.gd}</TableCell>
                              </>
                            )}
                            <TableCell className="text-center text-xs sm:text-sm py-2">{row.pw}</TableCell>
                            <TableCell className="text-center text-xs sm:text-sm py-2">{row.pl}</TableCell>
                            <TableCell className={`text-center font-medium text-xs sm:text-sm py-2 ${row.pd >= 0 ? 'text-sky-600' : 'text-red-600'}`}>
                              {row.pd >= 0 ? `+${row.pd}` : row.pd}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
