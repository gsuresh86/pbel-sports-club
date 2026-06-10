'use client';

import { Suspense, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import type { Match, Pool, Registration, Team, Tournament } from '@/types';
import {
  fetchTournament,
  fetchTournamentMatches,
  fetchTournamentPools,
  fetchTournamentRegistrations,
  fetchTournamentTeams,
} from '@/lib/tournament-api';
import TournamentStandingsView from '@/components/public/TournamentStandingsView';

function TournamentStandingsContent() {
  const params = useParams();
  const tournamentId = params.id as string;

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [participants, setParticipants] = useState<Registration[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tournamentId) return;

    async function load() {
      try {
        const [t, m, r, tm, p] = await Promise.all([
          fetchTournament(tournamentId),
          fetchTournamentMatches(tournamentId),
          fetchTournamentRegistrations(tournamentId),
          fetchTournamentTeams(tournamentId),
          fetchTournamentPools(tournamentId),
        ]);
        setTournament(t);
        setMatches(m.filter(match => match.status !== 'not-scheduled'));
        setParticipants(r);
        setTeams(tm);
        setPools(p);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [tournamentId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-slate-400 mb-4">Tournament not found</p>
          <Link href="/tournament" className="text-yellow-400 text-sm font-bold hover:underline">
            Back to tournaments
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-950 min-h-screen">
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center gap-3">
          <Link
            href={`/tournament/${tournamentId}`}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors flex-shrink-0 group"
          >
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline truncate max-w-[200px]">{tournament.name}</span>
            <span className="sm:hidden">Back</span>
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-sm font-bold text-white">Standings</span>
        </div>
      </div>

      <div className="relative overflow-hidden pt-12" style={{ minHeight: 180 }}>
        {tournament.banner ? (
          <>
            <Image
              src={tournament.banner}
              alt={tournament.name}
              fill
              className="object-cover object-center scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/60 to-slate-950" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950" />
        )}
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            Pool Standings
          </p>
          <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-xl">
            {tournament.name}
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            {pools.length} pool{pools.length !== 1 ? 's' : ''} · Live standings
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 pb-16">
        <TournamentStandingsView
          tournament={tournament}
          pools={pools}
          matches={matches}
          teams={teams}
          participants={participants}
          syncUrl
        />
      </div>

      <div className="border-t border-white/5 py-8 px-6 text-center">
        <p className="text-slate-500 text-xs">PBEL Sports Club · {tournament.name}</p>
      </div>
    </div>
  );
}

export default function TournamentStandingsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <TournamentStandingsContent />
    </Suspense>
  );
}
