'use client';

import { useState } from 'react';
import { addDoc } from 'firebase/firestore';
import { tournamentMatchesRef } from '@/lib/firestore-paths';
import {
  useTournamentPools,
  useTournamentTeams,
  useTournamentRegistrations,
  useInvalidateTournament,
} from '@/hooks/use-tournament-queries';
import { Tournament, CategoryType, Pool } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Users,
  Layers,
  CalendarClock,
  Swords,
  AlertTriangle,
  Zap,
} from 'lucide-react';

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const toISTLocal = (d: Date) => new Date(d.getTime() + IST_OFFSET_MS).toISOString().slice(0, 16);
const fromISTLocal = (v: string) => new Date(new Date(v + ':00Z').getTime() - IST_OFFSET_MS);

const TEAM_CATEGORIES: CategoryType[] = [
  'mens-team', 'womens-team', 'kids-team-u13', 'kids-team-u18', 'open-team',
];

const CATEGORY_LABELS: Record<string, string> = {
  'girls-under-13': 'Girls U13',
  'boys-under-13': 'Boys U13',
  'girls-under-18': 'Girls U18',
  'boys-under-18': 'Boys U18',
  'mens-single': "Men's Singles",
  'womens-single': "Women's Singles",
  'mens-doubles': "Men's Doubles",
  'womens-doubles': "Women's Doubles",
  'mixed-doubles': 'Mixed Doubles',
  'family-doubles': 'Family Doubles',
  'mens-team': "Men's Team",
  'womens-team': "Women's Team",
  'kids-team-u13': 'Kids Team U13',
  'kids-team-u18': 'Kids Team U18',
  'open-team': 'Open Team',
};

function label(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function matchCount(n: number) {
  return Math.max(0, (n * (n - 1)) / 2);
}

interface Props {
  tournament: Tournament;
  user: { id: string; role: string; email: string };
  onNotify?: (config: {
    title: string;
    description: string;
    variant?: 'default' | 'success' | 'error' | 'warning';
  }) => void;
  onGenerated?: (totalCreated: number) => void;
}

const STEPS = [
  { id: 1, label: 'Category', icon: Layers },
  { id: 2, label: 'Pool', icon: Users },
  { id: 3, label: 'Schedule', icon: CalendarClock },
];

export default function GenerateMatchesPanel({ tournament, user, onNotify, onGenerated }: Props) {
  const notify = onNotify ?? (() => {});
  const invalidateTournament = useInvalidateTournament();

  const { data: pools = [], isLoading: poolsLoading } = useTournamentPools(tournament.id);
  const { data: teams = [] } = useTournamentTeams(tournament.id);
  const { data: registrations = [] } = useTournamentRegistrations(tournament.id);

  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | null>(null);
  const [selectedPoolId, setSelectedPoolId] = useState<string | 'all'>('all');
  const [form, setForm] = useState({
    startDateTime: tournament.startDate ? toISTLocal(new Date(tournament.startDate)) : '',
    intervalMinutes: '30',
    matchFormat: ((tournament as any).matchFormat || 'best-of-3') as 'single-set' | 'best-of-3' | 'single-set-30',
  });
  const [generating, setGenerating] = useState(false);

  const isTeamCat = (cat: CategoryType) => TEAM_CATEGORIES.includes(cat);

  const getCategoryPools = (cat: CategoryType) => pools.filter(p => p.category === cat);

  const getPoolMembers = (pool: Pool) => {
    if (selectedCategory && isTeamCat(selectedCategory)) {
      return teams.filter(t => pool.teams.includes(t.id));
    }
    return registrations.filter(r => pool.teams.includes(r.id));
  };

  const getPreview = () => {
    if (!selectedCategory) return { total: 0, byPool: [] as { name: string; members: number; matches: number }[] };
    const catPools = getCategoryPools(selectedCategory);
    const target = selectedPoolId === 'all' ? catPools : catPools.filter(p => p.id === selectedPoolId);
    const byPool = target.map(p => {
      const n = getPoolMembers(p).length;
      return { name: p.name, members: n, matches: matchCount(n) };
    });
    return { total: byPool.reduce((s, p) => s + p.matches, 0), byPool };
  };

  const handleGenerate = async () => {
    if (!form.startDateTime) {
      notify({ title: 'Missing date', description: 'Please enter a start date and time (IST).', variant: 'error' });
      return;
    }
    setGenerating(true);
    try {
      const catPools = getCategoryPools(selectedCategory!);
      const target = selectedPoolId === 'all' ? catPools : catPools.filter(p => p.id === selectedPoolId);
      const startTime = fromISTLocal(form.startDateTime);
      const intervalMs = Math.max(0, parseInt(form.intervalMinutes) || 0) * 60 * 1000;
      let matchIndex = 0;
      let totalCreated = 0;

      for (const pool of target) {
        const items = getPoolMembers(pool);
        if (items.length < 2) continue;
        let matchNumber = 1;
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            await addDoc(tournamentMatchesRef(tournament.id), {
              tournamentId: tournament.id,
              round: pool.name,
              matchNumber,
              player1Id: items[i].id,
              player1Name: items[i].name,
              player2Id: items[j].id,
              player2Name: items[j].name,
              scheduledTime: new Date(startTime.getTime() + matchIndex * intervalMs),
              venue: tournament.venue || 'TBD',
              status: 'not-scheduled',
              sets: [],
              matchFormat: form.matchFormat,
              updatedAt: new Date(),
              createdBy: user.id,
            });
            matchNumber++;
            matchIndex++;
            totalCreated++;
          }
        }
      }

      if (totalCreated === 0) {
        notify({ title: 'No matches created', description: 'Each pool needs at least 2 participants.', variant: 'error' });
      } else {
        invalidateTournament(tournament.id);
        setStep(1);
        setSelectedCategory(null);
        setSelectedPoolId('all');
        onGenerated?.(totalCreated);
      }
    } catch (err) {
      notify({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to generate matches.', variant: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const preview = step === 3 ? getPreview() : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const done = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center flex-1 min-w-0">
              <button
                className={cn(
                  'flex items-center gap-2 shrink-0 rounded-lg px-2 py-1.5 text-sm font-medium transition-colors',
                  done ? 'text-blue-600 cursor-pointer hover:bg-blue-50' : active ? 'text-gray-900' : 'text-gray-400 cursor-default',
                )}
                onClick={() => done && setStep(s.id)}
                disabled={!done}
                type="button"
              >
                <span className={cn(
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold shrink-0',
                  done ? 'bg-blue-600 text-white' : active ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500',
                )}>
                  {done ? <Check className="h-3.5 w-3.5" /> : s.id}
                </span>
                <span className="hidden sm:block">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && (
                <div className={cn('flex-1 h-px mx-2', done ? 'bg-blue-600' : 'bg-gray-200')} />
              )}
            </div>
          );
        })}
      </div>

      {/* ─── Step 1: Category ─── */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Choose a category</h3>
            <p className="text-xs text-gray-500 mt-0.5">Matches will be generated for pools in this category.</p>
          </div>

          {poolsLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading pools…</div>
          ) : tournament.categories.length === 0 ? (
            <EmptyState message="No categories configured for this tournament." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tournament.categories.map(cat => {
                const catPools = getCategoryPools(cat as CategoryType);
                const totalMembers = catPools.reduce((s, p) => s + getPoolMembers(p).length, 0);
                const totalMatches = catPools.reduce((s, p) => s + matchCount(getPoolMembers(p).length), 0);
                const isTeam = isTeamCat(cat as CategoryType);
                const selected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat as CategoryType)}
                    className={cn(
                      'group relative flex flex-col gap-3 rounded-xl border-2 p-4 text-left transition-all',
                      selected
                        ? 'border-blue-600 bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40',
                    )}
                  >
                    {selected && (
                      <span className="absolute right-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <div className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-lg',
                      selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600',
                    )}>
                      {isTeam ? <Users className="h-4 w-4" /> : <Swords className="h-4 w-4" />}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{label(cat)}</div>
                      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-gray-500">
                        <span>{catPools.length} pool{catPools.length !== 1 ? 's' : ''}</span>
                        <span>{totalMembers} {isTeam ? 'teams' : 'players'}</span>
                        {totalMatches > 0 && <span>{totalMatches} matches</span>}
                      </div>
                    </div>
                    {catPools.length === 0 && (
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-amber-600">
                        <AlertTriangle className="h-3 w-3" /> No pools set up
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button
              disabled={!selectedCategory || getCategoryPools(selectedCategory).length === 0}
              onClick={() => { setSelectedPoolId('all'); setStep(2); }}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 2: Pool ─── */}
      {step === 2 && selectedCategory && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Select pool</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Generate matches for one specific pool or all pools in{' '}
              <span className="font-medium text-gray-700">{label(selectedCategory)}</span>.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {/* All pools option */}
            {(() => {
              const catPools = getCategoryPools(selectedCategory);
              const validPools = catPools.filter(p => getPoolMembers(p).length >= 2);
              const totalM = validPools.reduce((s, p) => s + matchCount(getPoolMembers(p).length), 0);
              const selected = selectedPoolId === 'all';
              return (
                <button
                  type="button"
                  onClick={() => setSelectedPoolId('all')}
                  className={cn(
                    'flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all',
                    selected
                      ? 'border-blue-600 bg-blue-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40',
                  )}
                >
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500',
                  )}>
                    <Layers className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900">All pools</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {catPools.length} pool{catPools.length !== 1 ? 's' : ''} · {totalM} matches total
                    </div>
                  </div>
                  {selected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                </button>
              );
            })()}

            {/* Individual pools */}
            {getCategoryPools(selectedCategory).map(pool => {
              const members = getPoolMembers(pool);
              const matches = matchCount(members.length);
              const insufficient = members.length < 2;
              const selected = selectedPoolId === pool.id;
              return (
                <button
                  key={pool.id}
                  type="button"
                  onClick={() => !insufficient && setSelectedPoolId(pool.id)}
                  disabled={insufficient}
                  className={cn(
                    'flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all',
                    insufficient
                      ? 'border-gray-100 bg-gray-50 opacity-60 cursor-not-allowed'
                      : selected
                        ? 'border-blue-600 bg-blue-50 shadow-sm'
                        : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40',
                  )}
                >
                  <div className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-bold',
                    selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600',
                  )}>
                    {pool.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-gray-900">{pool.name}</div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {members.length} {isTeamCat(selectedCategory) ? 'team' : 'player'}{members.length !== 1 ? 's' : ''}
                      {!insufficient && <> · {matches} match{matches !== 1 ? 'es' : ''}</>}
                      {insufficient && <span className="text-amber-600"> · needs 2+ participants</span>}
                    </div>
                  </div>
                  {selected && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button onClick={() => setStep(3)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Schedule ─── */}
      {step === 3 && selectedCategory && preview && (
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Schedule</h3>
            <p className="text-xs text-gray-500 mt-0.5">Set the timing for the generated matches.</p>
          </div>

          <div className="flex flex-col gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">Start Date &amp; Time (IST)</Label>
              <Input
                type="datetime-local"
                step="60"
                value={form.startDateTime}
                onChange={e => setForm(f => ({ ...f, startDateTime: e.target.value }))}
                className="h-9 text-sm"
              />
              <p className="text-xs text-gray-400">First match starts at this time</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Interval (minutes)</Label>
                <Input
                  type="number"
                  min="0"
                  step="5"
                  value={form.intervalMinutes}
                  onChange={e => setForm(f => ({ ...f, intervalMinutes: e.target.value }))}
                  className="h-9 text-sm"
                  placeholder="30"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Match Format</Label>
                <Select
                  value={form.matchFormat}
                  onValueChange={v => setForm(f => ({ ...f, matchFormat: v as typeof form.matchFormat }))}
                >
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single-set">Single set (21pt)</SelectItem>
                    <SelectItem value="best-of-3">Best of 3 (21pt)</SelectItem>
                    <SelectItem value="single-set-30">30pt Single set</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Preview box */}
          <div className={cn(
            'rounded-xl border p-4',
            preview.total === 0 ? 'border-amber-200 bg-amber-50' : 'border-blue-100 bg-blue-50',
          )}>
            {preview.total === 0 ? (
              <div className="flex items-center gap-2 text-amber-700 text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>No matches can be created — pools need at least 2 participants each.</span>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="text-sm font-semibold text-blue-900">
                    {preview.total} match{preview.total !== 1 ? 'es' : ''} will be created
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {preview.byPool.map(p => (
                    <div key={p.name} className="flex items-center justify-between text-xs text-blue-800">
                      <span className="font-medium">{p.name}</span>
                      <span className="text-blue-600">
                        {p.members} {isTeamCat(selectedCategory) ? 'teams' : 'players'} → {p.matches} match{p.matches !== 1 ? 'es' : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex justify-between pt-1">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || preview.total === 0 || !form.startDateTime}
              className="gap-2"
            >
              <Swords className="h-4 w-4" />
              {generating ? 'Generating…' : `Generate ${preview.total} match${preview.total !== 1 ? 'es' : ''}`}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <Layers className="h-10 w-10 text-gray-200 mb-3" />
      <p className="text-sm text-gray-500">{message}</p>
    </div>
  );
}
