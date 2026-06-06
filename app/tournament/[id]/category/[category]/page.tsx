'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { doc, getDoc, collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Tournament, Registration, Team, Pool } from '@/types';
import { ArrowLeft, Shield, Users, Star, Trophy, Users2 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

// ── helpers ────────────────────────────────────────────────────────────────
function fmtCategory(cat: string) {
  return cat.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function isTeamCategory(cat: string) {
  // Doubles are pair registrations (primary + partner), not team assignments
  if (cat.includes('doubles')) return false;
  // Kids and under-age categories are individual
  if (cat.includes('kids-team-u13') || cat.includes('kids-team-u18')) return false;
  if (cat.includes('under-')) return false;
  return cat.includes('team');
}

function isDoublesCategory(cat: string) {
  return cat.includes('doubles');
}


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

// ── Avatar helper ──────────────────────────────────────────────────────────
function Avatar({ name, photoUrl, size = 'lg' }: { name: string; photoUrl?: string; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  const initials = name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const px = { sm: 32, md: 48, lg: 80, xl: 96 }[size];
  const cls = { sm: 'w-8 h-8 text-xs', md: 'w-12 h-12 text-sm', lg: 'w-20 h-20 text-2xl', xl: 'w-24 h-24 text-3xl' }[size];
  const grad = CARD_GRADIENTS[name.charCodeAt(0) % CARD_GRADIENTS.length];
  return photoUrl ? (
    <div className={`${cls} rounded-full overflow-hidden flex-shrink-0 ring-2 ring-white/20`}>
      <Image src={photoUrl} alt={name} width={px} height={px} className="object-cover object-top w-full h-full" />
    </div>
  ) : (
    <div className={`${cls} rounded-full bg-gradient-to-b ${grad} flex items-center justify-center text-white font-bold flex-shrink-0 ring-2 ring-white/20`}>
      {initials}
    </div>
  );
}

// ── Single player card (IPL portrait) ─────────────────────────────────────
function PlayerCard({ player, isCaptain }: { player: Registration; isCaptain?: boolean }) {
  const initials = player.name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const grad = CARD_GRADIENTS[player.name.charCodeAt(0) % CARD_GRADIENTS.length];

  return (
    <div className="group relative rounded-lg overflow-hidden border border-white/5 shadow hover:shadow-xl transition-all duration-200 hover:-translate-y-1 bg-slate-900">
      <div className={`relative bg-gradient-to-b ${grad} overflow-hidden`} style={{ aspectRatio: '3/4' }}>
        {player.profilePhotoUrl ? (
          <Image src={player.profilePhotoUrl} alt={player.name} fill className="object-cover object-top" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <div className="w-14 h-14 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-white text-xl font-bold">
              {initials}
            </div>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/70 to-transparent" />
        {isCaptain && (
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-yellow-400 text-black text-[8px] font-black px-1 py-0.5 rounded-full uppercase tracking-wide">
            <Star className="h-2 w-2 fill-black" /> C
          </div>
        )}
        {(player.tower || player.flatNumber) && (
          <p className="absolute bottom-1 left-0 right-0 text-center text-[9px] text-white/70 font-medium">
            {player.tower}{player.flatNumber ? ` - ${player.flatNumber}` : ''}
          </p>
        )}
      </div>
      <div className="px-1.5 py-1.5 text-center">
        <p className="text-[11px] font-black uppercase tracking-wide text-white leading-tight truncate" title={player.name}>
          {player.name}
        </p>
      </div>
    </div>
  );
}

// ── Doubles pair card ──────────────────────────────────────────────────────
function DoublesCard({ registration }: { registration: Registration }) {
  const hasPartner = !!registration.partnerName?.trim();
  const partnerName = registration.partnerName ?? '';
  const partnerPhoto = registration.partnerProfilePhotoUrl;
  return (
    <div className="rounded-2xl overflow-hidden border border-white/5 bg-slate-900 hover:border-yellow-400/20 hover:-translate-y-1 transition-all duration-200 shadow hover:shadow-xl">
      {/* Two avatars side by side */}
      <div className="relative bg-gradient-to-b from-slate-800 to-slate-900 p-5 flex items-end justify-center gap-3">
        {/* Decorative lines */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-400/20 to-transparent" />
        </div>

        <div className="flex flex-col items-center gap-1.5 z-10">
          <Avatar name={registration.name} photoUrl={registration.profilePhotoUrl} size="lg" />
          <p className="text-[10px] font-black uppercase tracking-wide text-white text-center leading-tight max-w-[72px] truncate">
            {registration.name.split(' ')[0]}
          </p>
          {(registration.tower || registration.flatNumber) && (
            <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full text-slate-300 bg-slate-700">
              {registration.tower}{registration.flatNumber ? `-${registration.flatNumber}` : ''}
            </span>
          )}
        </div>

        {/* VS divider */}
        <div className="flex flex-col items-center gap-1 pb-6 z-10">
          <div className="w-px h-8 bg-white/20" />
          <span className="text-[9px] font-black text-white/40 uppercase">pair</span>
          <div className="w-px h-8 bg-white/20" />
        </div>

        {hasPartner ? (
          <div className="flex flex-col items-center gap-1.5 z-10">
            <Avatar name={partnerName} photoUrl={partnerPhoto} size="lg" />
            <p className="text-[10px] font-black uppercase tracking-wide text-white text-center leading-tight max-w-[72px] truncate">
              {partnerName.split(' ')[0]}
            </p>
            {(registration.partnerTower || registration.partnerFlatNumber) ? (
              <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full text-slate-300 bg-slate-700">
                {registration.partnerTower}{registration.partnerFlatNumber ? `-${registration.partnerFlatNumber}` : ''}
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 z-10 opacity-30">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-white/30 flex items-center justify-center">
              <Users className="h-8 w-8 text-white/30" />
            </div>
            <p className="text-[10px] text-slate-500 uppercase">TBD</p>
          </div>
        )}
      </div>

      {/* Names strip */}
      <div className="px-4 py-2.5 border-t border-white/5 text-center">
        <p className="text-xs font-bold text-white truncate">
          {registration.name}{hasPartner ? ` & ${partnerName}` : ''}
        </p>
        {(registration.tower || registration.flatNumber) && (
          <p className="text-[10px] text-slate-500 mt-0.5">
            {registration.tower}{registration.flatNumber ? ` - ${registration.flatNumber}` : ''}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Pool standings ─────────────────────────────────────────────────────────
function PoolStandings({ pool, teams, participants, isTeamCat, isDoubles }: {
  pool: Pool; teams: Team[]; participants: Registration[]; isTeamCat: boolean; isDoubles?: boolean;
}) {
  return (
    <div className="bg-slate-900 rounded-2xl border border-white/5 overflow-hidden">
      <div className="bg-gradient-to-r from-purple-600/20 to-indigo-500/10 px-5 py-3 border-b border-white/5 flex items-center justify-between">
        <div>
          <h4 className="font-black text-white">{pool.name}</h4>
          <p className="text-xs text-slate-400 mt-0.5">{pool.teams.length} {isTeamCat ? 'teams' : 'players'} · max {pool.maxTeams}</p>
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
                  {isDoubles && player?.partnerName && (
                    <p className="text-[10px] text-slate-400 truncate">w/ {player.partnerName}</p>
                  )}
                  {(player?.tower || player?.flatNumber) && (
                    <p className="text-[10px] text-slate-500">{player.tower} {player.flatNumber}</p>
                  )}
                </div>
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

  useEffect(() => { if (tournamentId) loadAll(); }, [tournamentId]);

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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const catTeams = teams.filter(t => t.category === categorySlug);
  const catPlayers = participants.filter(p => p.selectedCategory === categorySlug);
  const catPools = pools.filter(p => p.category === categorySlug);
  const isCatTeam = isTeamCategory(categorySlug);
  const isDoubles = isDoublesCategory(categorySlug);
  const label = fmtCategory(categorySlug);
  const poolsAvailable = catPools.length > 0;

  return (
    <div className="bg-slate-950 min-h-screen">

      {/* ── Custom top bar ─────────────────────────────────────── */}
      <div className="fixed top-0 left-0 right-0 z-40 bg-slate-950/80 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-12 flex items-center gap-3">
          <Link href={`/tournament/${tournamentId}`}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs transition-colors flex-shrink-0 group">
            <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="hidden sm:inline">{tournament?.name ?? 'Tournament'}</span>
          </Link>
          <span className="text-slate-600">/</span>
          <span className="text-sm font-bold text-white truncate">{label}</span>
          <div className="flex-1" />
          {poolsAvailable && (
            <div className="flex gap-1 bg-slate-800 p-0.5 rounded-full">
              {([['squads', isCatTeam ? 'Squads' : isDoubles ? 'Pairs' : 'Players'], ['pools', 'Pools']] as const).map(([id, lbl]) => (
                <button key={id} onClick={() => setActiveSection(id)}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${activeSection === id ? 'bg-yellow-400 text-black' : 'text-slate-400 hover:text-white'}`}>
                  {lbl}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Category hero — uses tournament banner ──────────────── */}
      <div className="relative overflow-hidden pt-12" style={{ minHeight: 220 }}>
        {/* Banner image */}
        {tournament?.banner && (
          <>
            <Image src={tournament.banner} alt={tournament.name} fill className="object-cover object-center scale-105" />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/70 via-slate-950/60 to-slate-950" />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-slate-950/50" />
          </>
        )}
        {/* Fallback gradient when no banner */}
        {!tournament?.banner && (
          <>
            <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950" />
            <div className="absolute -top-32 -right-32 w-96 h-96 bg-yellow-400/5 rounded-full blur-3xl pointer-events-none" />
          </>
        )}
        <div className="relative z-10 max-w-7xl mx-auto px-6 py-10">
          <p className="text-xs text-yellow-400 font-bold uppercase tracking-widest mb-2">Category</p>
          <h1 className="text-4xl sm:text-5xl font-black text-white tracking-tight drop-shadow-xl">{label}</h1>
          <div className="flex flex-wrap gap-4 mt-4 text-sm text-slate-300">
            {isCatTeam && <span className="flex items-center gap-1.5"><Shield className="h-4 w-4 text-purple-400" />{catTeams.length} Teams</span>}
            <span className="flex items-center gap-1.5">
              <Users className="h-4 w-4 text-blue-400" />
              {isDoubles ? `${catPlayers.length} pairs` : `${catPlayers.length} players`}
            </span>
            {poolsAvailable && <span className="flex items-center gap-1.5"><Users2 className="h-4 w-4 text-emerald-400" />{catPools.length} Pools</span>}
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-12">

        {/* TEAM CATEGORIES — tab-controlled */}
        {isCatTeam && activeSection === 'squads' && (
          catTeams.length === 0 ? (
            <div className="text-center py-24">
              <Shield className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No teams assigned to this category yet</p>
            </div>
          ) : (
            catTeams.map((team, ti) => {
              const players = team.players.map(id => participants.find(p => p.id === id)).filter(Boolean) as Registration[];
              const grad = TEAM_HEADER_GRADIENTS[ti % TEAM_HEADER_GRADIENTS.length];
              return (
                <section key={team.id}>
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
                  {players.length === 0 ? (
                    <p className="text-slate-500 text-sm italic px-2">No players assigned yet</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                      {players.map((player) => (
                        <PlayerCard key={player.id} player={player} isCaptain={player.id === team.captainId} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })
          )
        )}

        {isCatTeam && activeSection === 'pools' && (
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
                  <PoolStandings key={pool.id} pool={pool} teams={teams} participants={participants} isTeamCat={true} isDoubles={false} />
                ))}
              </div>
            )}
          </section>
        )}

        {/* INDIVIDUAL / DOUBLES — tab-controlled when pools exist */}
        {!isCatTeam && (!poolsAvailable || activeSection === 'squads') && (
          catPlayers.length === 0 ? (
            <div className="text-center py-24">
              <Users className="h-12 w-12 text-slate-600 mx-auto mb-4" />
              <p className="text-slate-400">No players registered in this category yet</p>
            </div>
          ) : (
            <section>
              <h2 className="text-xs uppercase tracking-widest text-yellow-400 font-bold mb-5 flex items-center gap-2">
                <Trophy className="h-3.5 w-3.5" />
                {isDoubles ? 'Pairs' : 'Players'} — {label}
              </h2>
              {isDoubles ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {catPlayers.map(reg => (
                    <DoublesCard key={reg.id} registration={reg} />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2">
                  {catPlayers.map(player => (
                    <PlayerCard key={player.id} player={player} />
                  ))}
                </div>
              )}
            </section>
          )
        )}

        {!isCatTeam && poolsAvailable && activeSection === 'pools' && (
          <section>
            <h2 className="text-xs uppercase tracking-widest text-yellow-400 font-bold mb-5 flex items-center gap-2">
              <Users2 className="h-3.5 w-3.5" /> Pools — {label}
            </h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catPools.map(pool => (
                <PoolStandings key={pool.id} pool={pool} teams={teams} participants={participants} isTeamCat={false} isDoubles={isDoubles} />
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="border-t border-white/5 mt-12 py-6 px-6 text-center">
        <p className="text-slate-500 text-xs">{tournament?.name} · {label}</p>
      </div>
    </div>
  );
}
