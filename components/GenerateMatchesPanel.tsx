'use client';

import { useState, useEffect, type ComponentType } from 'react';
import { addDoc, doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { tournamentMatchesRef, tournamentMatchRef } from '@/lib/firestore-paths';
import {
  useTournamentPools,
  useTournamentTeams,
  useTournamentRegistrations,
  useTournamentMatches,
  useInvalidateTournament,
} from '@/hooks/use-tournament-queries';
import { Tournament, CategoryType, Pool, Match } from '@/types';
import { MATCH_FORMAT_SELECT_OPTIONS, type MatchFormat } from '@/lib/match-scoring';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DateTimePickerInput } from '@/components/ui/date-picker-input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Check,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Users,
  Layers,
  Swords,
  AlertTriangle,
  Zap,
  Trophy,
  Plus,
  Wand2,
  Hand,
  Medal,
  Search,
} from 'lucide-react';
import {
  KNOCKOUT_ROUND_LABELS,
  getAvailableKnockoutRounds,
  shouldOfferPreliminaryKnockoutRound,
  type KnockoutRound,
  type BracketSlotMember,
  previewKnockoutRound,
  getCategoryQualifyCount,
  getKnockoutSlotMembers,
  getRoundWinnerSlotMembers,
  getQualifiedByPool,
  filterKnockoutMatchesForCategory,
  isKnockoutRound,
  bracketSlotDisplayLabel,
  getBracketSlotStorageSide,
  isKnockoutBracketPlaceholder,
  getKnockoutPropagationUpdates,
} from '@/lib/knockoutBracket';
import {
  IPL_PLAYOFF_ROUNDS,
  IPL_PLAYOFF_ROUND_LABELS,
  type IplPlayoffRound,
  previewIplPlayoffRound,
  getPoolTopFour,
  getIplPlayoffSlotMembers,
  filterIplRoundMatches,
} from '@/lib/iplPlayoff';
import { isRubberMatch } from '@/lib/teamMatchRubbers';

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

type SlotMember = BracketSlotMember;

function MemberSelectField({
  label,
  value,
  onChange,
  members,
  disabled,
  memberLabel,
  includePoolName,
  getDisplayLabel,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  members: Array<{ id: string; name: string } & Partial<SlotMember>>;
  disabled?: boolean;
  memberLabel: string;
  includePoolName?: boolean;
  getDisplayLabel: (member: { id: string; name: string } & Partial<SlotMember>, includePool?: boolean) => string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const selected = members.find(m => m.id === value);
  const query = search.trim().toLowerCase();
  const filteredMembers = query
    ? members.filter(member => getDisplayLabel(member, includePoolName).toLowerCase().includes(query))
    : members;

  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-gray-700">{label}</Label>
      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) setSearch('');
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="h-9 w-full justify-between bg-white px-3 text-sm font-normal"
          >
            <span className="truncate text-left">
              {selected ? getDisplayLabel(selected, includePoolName) : `Select ${memberLabel}`}
            </span>
            <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="z-[100] w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="border-b border-gray-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${memberLabel}…`}
                className="h-8 pl-8 text-xs"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filteredMembers.length === 0 ? (
              <p className="px-3 py-2 text-xs text-gray-500">No matches found.</p>
            ) : (
              filteredMembers.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className={cn(
                    'flex w-full rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground',
                    value === m.id && 'bg-accent text-accent-foreground',
                  )}
                  onClick={() => {
                    onChange(m.id);
                    setOpen(false);
                    setSearch('');
                  }}
                >
                  {getDisplayLabel(m, includePoolName)}
                </button>
              ))
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function label(cat: string) {
  return CATEGORY_LABELS[cat] ?? cat.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function matchCount(n: number) {
  return Math.max(0, (n * (n - 1)) / 2);
}

type SetupMethod = 'auto' | 'manual';
type AutoFormat = 'pool' | 'knockout' | 'ipl-playoff';
type GenerationMode = AutoFormat | 'manual';
type BracketFormat = 'knockout' | 'ipl-playoff';

function SegmentedOption({
  selected,
  onClick,
  icon: Icon,
  title,
  description,
}: {
  selected: boolean;
  onClick: () => void;
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 min-w-0 items-start gap-3 rounded-xl border-2 p-3.5 text-left transition-all',
        selected ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-200 bg-white hover:border-blue-300 hover:bg-blue-50/40',
      )}
    >
      <div className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
        selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500',
      )}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-gray-900">{title}</div>
        <div className="text-xs text-gray-500 mt-0.5 leading-snug">{description}</div>
      </div>
      {selected && <Check className="h-4 w-4 text-blue-600 shrink-0 ml-auto" />}
    </button>
  );
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
  { id: 2, label: 'Setup', icon: Users },
];

export default function GenerateMatchesPanel({ tournament, user, onNotify, onGenerated }: Props) {
  const notify = onNotify ?? (() => {});
  const invalidateTournament = useInvalidateTournament();

  const { data: pools = [], isLoading: poolsLoading } = useTournamentPools(tournament.id);
  const { data: teams = [] } = useTournamentTeams(tournament.id);
  const { data: registrations = [] } = useTournamentRegistrations(tournament.id);
  const { data: matches = [] } = useTournamentMatches(tournament.id);

  const [step, setStep] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState<CategoryType | null>(null);
  const [setupMethod, setSetupMethod] = useState<SetupMethod>('auto');
  const [matchFormat, setMatchFormat] = useState<AutoFormat>('pool');
  const generationMode: GenerationMode = setupMethod === 'manual' ? 'manual' : matchFormat;
  const [selectedPoolId, setSelectedPoolId] = useState<string | 'all'>('all');
  const [knockoutRound, setKnockoutRound] = useState<KnockoutRound>('QF');
  const [iplPlayoffRound, setIplPlayoffRound] = useState<IplPlayoffRound>('Qualifier1');
  const [iplPlayoffPoolId, setIplPlayoffPoolId] = useState('');
  const [categoryQualifyCount, setCategoryQualifyCount] = useState('2');
  const [form, setForm] = useState({
    startDateTime: tournament.startDate ? toISTLocal(new Date(tournament.startDate)) : '',
    intervalMinutes: '30',
    matchFormat: ((tournament as any).matchFormat || 'best-of-3') as MatchFormat,
  });
  const [generating, setGenerating] = useState(false);
  const [manualPoolId, setManualPoolId] = useState('');
  const [manualPlayer1Id, setManualPlayer1Id] = useState('');
  const [manualPlayer2Id, setManualPlayer2Id] = useState('');
  const [manualMatchNo, setManualMatchNo] = useState('');
  const [manualKnockoutRound, setManualKnockoutRound] = useState<KnockoutRound>('QF');
  const [manualMatchRound, setManualMatchRound] = useState('');

  const getCategoryMatches = () => {
    if (!selectedCategory) return [];
    const catPools = getCategoryPools(selectedCategory);
    const poolNameToCategory = new Map(catPools.map(p => [p.name, selectedCategory]));
    return matches.filter(m => {
      if (isRubberMatch(m)) return false;
      const cat = m.category ?? poolNameToCategory.get(m.round);
      return cat === selectedCategory;
    });
  };

  const getCategoryMatchRounds = (): { round: string; matchCount: number }[] => {
    if (!selectedCategory) return [];
    const roundCounts = new Map<string, number>();
    for (const m of getCategoryMatches()) {
      roundCounts.set(m.round, (roundCounts.get(m.round) ?? 0) + 1);
    }
    return Array.from(roundCounts.entries())
      .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
      .map(([round, matchCount]) => ({ round, matchCount }));
  };

  const getMatchRoundSelectOptions = (): { value: string; label: string }[] => {
    const fromMatches = getCategoryMatchRounds().map(({ round, matchCount }) => ({
      value: round,
      label: matchCount > 0 ? `${round} (${matchCount} match${matchCount !== 1 ? 'es' : ''})` : round,
    }));
    const prevRound = KNOCKOUT_PREV_ROUND[getManualKnockoutRound()];
    if (prevRound && !fromMatches.some(o => o.value === prevRound)) {
      return [{ value: prevRound, label: `${KNOCKOUT_ROUND_LABELS[prevRound]} (${prevRound})` }, ...fromMatches];
    }
    return fromMatches.length > 0 ? fromMatches : (
      prevRound
        ? [{ value: prevRound, label: `${KNOCKOUT_ROUND_LABELS[prevRound]} (${prevRound})` }]
        : []
    );
  };

  const KNOCKOUT_PREV_ROUND: Partial<Record<KnockoutRound, KnockoutRound>> = {
    QF: 'KO',
    SF: 'QF',
    F: 'SF',
    TP: 'SF',
  };

  const getActiveMatchRound = () => {
    if (manualMatchRound) return manualMatchRound;
    const prevRound = KNOCKOUT_PREV_ROUND[getManualKnockoutRound()];
    return prevRound ?? manualKnockoutRound;
  };

  const getManualKnockoutRound = (): KnockoutRound => {
    if (matchFormat !== 'knockout') return knockoutRound;
    return manualKnockoutRound;
  };

  const isTeamCat = (cat: CategoryType) => TEAM_CATEGORIES.includes(cat);

  const getCategoryPools = (cat: CategoryType) => pools.filter(p => p.category === cat);

  const getPoolMembers = (pool: Pool) => {
    const cat = selectedCategory ?? pool.category;
    if (isTeamCat(cat)) {
      return teams.filter(t => pool.teams.includes(t.id));
    }
    return registrations.filter(r => pool.teams.includes(r.id));
  };

  const getManualPool = () => pools.find(p => p.id === manualPoolId) ?? null;

  const getIplPlayoffPool = () => {
    if (!selectedCategory) return null;
    const catPools = getCategoryPools(selectedCategory);
    if (iplPlayoffPoolId) {
      return catPools.find(p => p.id === iplPlayoffPoolId) ?? catPools[0] ?? null;
    }
    return catPools[0] ?? null;
  };

  const isBracketFormat = (fmt: AutoFormat): fmt is BracketFormat =>
    fmt === 'knockout' || fmt === 'ipl-playoff';

  const getQualifiedMembersForKnockout = (): SlotMember[] => {
    if (!selectedCategory) return [];
    const catPools = getCategoryPools(selectedCategory);
    const qualifiedData = getQualifiedByPool(catPools, matches, {
      isTeamCat: isTeamCat(selectedCategory),
      teams,
      registrations,
      categoryQualifyCounts: tournament.categoryQualifyCounts,
    });
    return qualifiedData.flatMap(({ pool, qualified }) =>
      qualified.map(p => ({
        id: p.id,
        name: p.name,
        slotLabel: `#${p.poolRank} ${pool.name}`,
        isResolved: true,
      })),
    );
  };

  const getPreviousRoundSlots = (): SlotMember[] | null => {
    if (!selectedCategory) return null;
    return getKnockoutSlotMembers(getManualKnockoutRound(), selectedCategory, matches);
  };

  const getIplPreviousRoundSlots = (): SlotMember[] | null => {
    if (!selectedCategory || matchFormat !== 'ipl-playoff') return null;
    if (iplPlayoffRound === 'Qualifier1' || iplPlayoffRound === 'Eliminator') return null;
    return getIplPlayoffSlotMembers(iplPlayoffRound, selectedCategory, matches);
  };

  const getCategoryParticipants = () => {
    if (!selectedCategory) return [];
    if (isTeamCat(selectedCategory)) {
      return teams.filter(t => t.category === selectedCategory);
    }
    return registrations.filter(
      r => r.selectedCategory === selectedCategory && r.registrationStatus === 'approved',
    );
  };

  const getManualMembers = () => {
    if (!selectedCategory) return [];
    if (matchFormat === 'ipl-playoff') {
      const slots = getIplPreviousRoundSlots();
      if (slots !== null) return slots;
      const pool = getIplPlayoffPool();
      if (!pool) return [];
      const topFour = getPoolTopFour(pool, matches, {
        isTeamCat: isTeamCat(selectedCategory),
        teams,
        registrations,
      });
      return topFour.map(p => ({
        id: p.id,
        name: p.name,
        slotLabel: `#${p.poolRank}`,
        isResolved: true,
      }));
    }
    if (matchFormat === 'knockout') {
      const knockoutType = getManualKnockoutRound();
      const selectedRound = getActiveMatchRound();
      const slotMode = knockoutType === 'TP' ? 'losers' : 'winners';
      const roundSlots = getRoundWinnerSlotMembers(selectedRound, selectedCategory, matches, slotMode);
      if (roundSlots.length > 0) return roundSlots;

      if (knockoutType === 'KO') return getQualifiedMembersForKnockout();

      const slots = getKnockoutSlotMembers(knockoutType, selectedCategory, matches);
      if (slots !== null) return slots;
      return getQualifiedMembersForKnockout();
    }
    const pool = getManualPool();
    return pool ? getPoolMembers(pool) : [];
  };

  const resetManualForm = () => {
    setManualPlayer1Id('');
    setManualPlayer2Id('');
    setManualMatchNo('');
  };

  const getKnockoutRoundOptions = (): KnockoutRound[] => {
    if (!selectedCategory) return getAvailableKnockoutRounds(false);
    const catPools = getCategoryPools(selectedCategory);
    const offerKo = shouldOfferPreliminaryKnockoutRound(catPools, pool => getPoolMembers(pool).length);
    return getAvailableKnockoutRounds(offerKo);
  };

  const getMemberDisplayLabel = (
    member: { id: string; name: string } & Partial<SlotMember>,
    forKnockoutPoolHint = false,
  ) => {
    if (member.slotLabel) {
      return bracketSlotDisplayLabel(member as BracketSlotMember);
    }
    const poolName = pools.find(p => p.teams.includes(member.id))?.name;
    return member.name + (poolName && forKnockoutPoolHint ? ` · ${poolName}` : '');
  };

  // Auto-fill bracket slot placeholders for prior-round winners/losers
  useEffect(() => {
    if (setupMethod !== 'manual' || !isBracketFormat(matchFormat)) return;
    const slots = matchFormat === 'ipl-playoff' ? getIplPreviousRoundSlots() : getPreviousRoundSlots();
    if (!slots) return;
    const slot1 = slots[0];
    const slot2 = slots[1];
    if (slot1) {
      setManualPlayer1Id(prev => (!prev || prev.startsWith('tbd-')) ? slot1.id : prev);
    }
    if (slot2) {
      setManualPlayer2Id(prev => (!prev || prev.startsWith('tbd-')) ? slot2.id : prev);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [knockoutRound, manualKnockoutRound, manualMatchRound, iplPlayoffRound, selectedCategory, setupMethod, matchFormat, matches]);

  useEffect(() => {
    if (matchFormat !== 'knockout' || !selectedCategory) return;
    const options = getKnockoutRoundOptions();
    if (!options.includes(knockoutRound)) {
      setKnockoutRound(options[0] ?? 'QF');
      resetManualForm();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, matchFormat, pools, teams, registrations]);

  useEffect(() => {
    if (matchFormat !== 'knockout' || !selectedCategory) return;
    const rounds = getCategoryMatchRounds();
    if (rounds.some(r => r.round === manualMatchRound)) return;
    const prevRound = KNOCKOUT_PREV_ROUND[manualKnockoutRound];
    const preferred = prevRound
      ? (rounds.find(r => r.round === prevRound)?.round ?? prevRound)
      : rounds[0]?.round;
    if (preferred) setManualMatchRound(preferred);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, matchFormat, matches, manualKnockoutRound]);

  const getManualPreview = () => {
    const members = getManualMembers();
    const p1 = members.find(m => m.id === manualPlayer1Id);
    const p2 = members.find(m => m.id === manualPlayer2Id);
    const pool = getManualPool();
    if (!p1 || !p2) return null;
    if (matchFormat === 'pool' && !pool) return null;
    const round = matchFormat === 'knockout'
      ? getManualKnockoutRound()
      : matchFormat === 'ipl-playoff'
        ? iplPlayoffRound
        : pool!.name;
    const isBracket = matchFormat === 'knockout' || matchFormat === 'ipl-playoff';
    return { pool, p1, p2, round, isBracket };
  };

  const getPoolPreview = () => {
    if (!selectedCategory) return { total: 0, byPool: [] as { name: string; members: number; matches: number }[] };
    const catPools = getCategoryPools(selectedCategory);
    const target = selectedPoolId === 'all' ? catPools : catPools.filter(p => p.id === selectedPoolId);
    const byPool = target.map(p => {
      const n = getPoolMembers(p).length;
      return { name: p.name, members: n, matches: matchCount(n) };
    });
    return { total: byPool.reduce((s, p) => s + p.matches, 0), byPool };
  };

  const getKnockoutPreview = () => {
    if (!selectedCategory) return { pairings: [], warnings: [] as string[], qualifiedCount: 0 };
    return previewKnockoutRound(knockoutRound, selectedCategory, pools, matches, {
      teams,
      registrations,
      categoryQualifyCounts: tournament.categoryQualifyCounts,
    });
  };

  const getIplPlayoffPreview = () => {
    if (!selectedCategory) return { pairings: [], warnings: [] as string[], qualifiedCount: 0 };
    const pool = getIplPlayoffPool();
    if (!pool) return { pairings: [], warnings: ['Select a pool for IPL playoff.'], qualifiedCount: 0 };
    return previewIplPlayoffRound(iplPlayoffRound, selectedCategory, pool, matches, {
      teams,
      registrations,
    });
  };

  const syncCategoryQualifyCount = (cat: CategoryType) => {
    setCategoryQualifyCount(String(getCategoryQualifyCount(cat, tournament.categoryQualifyCounts)));
  };

  const saveCategoryQualifyCount = async () => {
    if (!selectedCategory) return;
    const count = Math.max(1, parseInt(categoryQualifyCount) || 2);
    await updateDoc(doc(db, 'tournaments', tournament.id), {
      categoryQualifyCounts: {
        ...(tournament.categoryQualifyCounts ?? {}),
        [selectedCategory]: count,
      },
      updatedAt: new Date(),
    });
    invalidateTournament(tournament.id);
    setCategoryQualifyCount(String(count));
  };

  const handleGeneratePool = async () => {
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
    return totalCreated;
  };

  const handleGenerateKnockout = async () => {
    if (!selectedCategory) return 0;
    const preview = getKnockoutPreview();
    if (preview.pairings.length === 0) return 0;

    const count = Math.max(1, parseInt(categoryQualifyCount) || 2);
    await saveCategoryQualifyCount();

    const startTime = fromISTLocal(form.startDateTime);
    const intervalMs = Math.max(0, parseInt(form.intervalMinutes) || 0) * 60 * 1000;
    const existingInRound = matches.filter(
      m => m.round === knockoutRound && m.category === selectedCategory,
    );
    const existingCount = existingInRound.length;
    const isSingleMatch = knockoutRound === 'F' || knockoutRound === 'TP';
    let totalCreated = 0;

    for (let i = 0; i < preview.pairings.length; i++) {
      const pairing = preview.pairings[i];
      const matchNumber = isSingleMatch
        ? knockoutRound
        : `${knockoutRound}${existingCount + i + 1}`;
      await addDoc(tournamentMatchesRef(tournament.id), {
        tournamentId: tournament.id,
        category: selectedCategory,
        round: knockoutRound,
        matchNumber,
        player1Id: pairing.player1.id,
        player1Name: pairing.player1.name,
        player2Id: pairing.player2.id,
        player2Name: pairing.player2.name,
        scheduledTime: new Date(startTime.getTime() + i * intervalMs),
        venue: tournament.venue || 'TBD',
        status: 'not-scheduled',
        sets: [],
        matchFormat: form.matchFormat,
        updatedAt: new Date(),
        createdBy: user.id,
      });
      totalCreated++;
    }
    return totalCreated;
  };

  const handleGenerateIplPlayoff = async () => {
    if (!selectedCategory) return 0;
    const preview = getIplPlayoffPreview();
    if (preview.pairings.length === 0) return 0;

    const startTime = fromISTLocal(form.startDateTime);
    const intervalMs = Math.max(0, parseInt(form.intervalMinutes) || 0) * 60 * 1000;
    const existingInRound = filterIplRoundMatches(
      matches.filter(m => m.category === selectedCategory),
      iplPlayoffRound,
    );
    if (existingInRound.length > 0) return 0;

    let totalCreated = 0;
    for (let i = 0; i < preview.pairings.length; i++) {
      const pairing = preview.pairings[i];
      await addDoc(tournamentMatchesRef(tournament.id), {
        tournamentId: tournament.id,
        category: selectedCategory,
        round: iplPlayoffRound,
        matchNumber: iplPlayoffRound,
        player1Id: pairing.player1.id,
        player1Name: pairing.player1.name,
        player2Id: pairing.player2.id,
        player2Name: pairing.player2.name,
        scheduledTime: new Date(startTime.getTime() + i * intervalMs),
        venue: tournament.venue || 'TBD',
        status: 'not-scheduled',
        sets: [],
        matchFormat: form.matchFormat,
        updatedAt: new Date(),
        createdBy: user.id,
      });
      totalCreated++;
    }
    return totalCreated;
  };

  const toStoredMatchSide = (member: { id: string; name: string; slotLabel?: string }) => {
    if (member.slotLabel) {
      return getBracketSlotStorageSide(member as BracketSlotMember);
    }
    if (isKnockoutBracketPlaceholder(member.id, member.name)) {
      return { id: member.id, name: member.name };
    }
    return { id: member.id, name: member.name };
  };

  const handleGenerateManual = async () => {
    const preview = getManualPreview();
    if (!preview || !selectedCategory) return 0;
    const { p1, p2, round, isBracket } = preview;
    const side1 = toStoredMatchSide(p1);
    const side2 = toStoredMatchSide(p2);
    const knockoutType = matchFormat === 'knockout' ? getManualKnockoutRound() : null;
    const existingInRound = matches.filter(m =>
      m.round === round && (isBracket ? m.category === selectedCategory : true),
    );
    const existingCount = existingInRound.length;
    const isSingleBracketMatch = knockoutType
      ? knockoutType === 'F' || knockoutType === 'TP'
      : round === 'F' || round === 'TP'
        || (matchFormat === 'ipl-playoff' && (IPL_PLAYOFF_ROUNDS as readonly string[]).includes(round));
    const autoMatchNumber = isBracket
      ? (isSingleBracketMatch
        ? (knockoutType ?? round)
        : `${knockoutType ?? round}${existingCount + 1}`)
      : existingCount + 1;
    const matchNumber = manualMatchNo.trim() !== '' ? manualMatchNo.trim() : autoMatchNumber;

    const docRef = await addDoc(tournamentMatchesRef(tournament.id), {
      tournamentId: tournament.id,
      ...(isBracket ? { category: selectedCategory } : {}),
      round,
      matchNumber,
      player1Id: side1.id,
      player1Name: side1.name,
      player2Id: side2.id,
      player2Name: side2.name,
      scheduledTime: fromISTLocal(form.startDateTime),
      venue: tournament.venue || 'TBD',
      status: 'scheduled',
      sets: [],
      matchFormat: form.matchFormat,
      updatedAt: new Date(),
      createdBy: user.id,
    });

    if (matchFormat === 'knockout') {
      const newMatch: Match = {
        id: docRef.id,
        tournamentId: tournament.id,
        category: selectedCategory,
        round,
        matchNumber,
        player1Id: side1.id,
        player1Name: side1.name,
        player2Id: side2.id,
        player2Name: side2.name,
        scheduledTime: fromISTLocal(form.startDateTime),
        venue: tournament.venue || 'TBD',
        status: 'scheduled',
        sets: [],
        matchFormat: form.matchFormat,
        updatedAt: new Date(),
        createdBy: user.id,
      };
      const allWithNew = [...matches, newMatch];
      for (const completed of matches) {
        if (completed.status !== 'completed' || completed.category !== selectedCategory) continue;
        if (!isKnockoutRound(completed.round)) continue;
        const updates = getKnockoutPropagationUpdates(completed, allWithNew);
        const patch = updates.find(u => u.matchId === docRef.id);
        if (!patch) continue;
        await updateDoc(tournamentMatchRef(tournament.id, docRef.id), {
          ...(patch.player1Id != null && { player1Id: patch.player1Id }),
          ...(patch.player1Name != null && { player1Name: patch.player1Name }),
          ...(patch.player2Id != null && { player2Id: patch.player2Id }),
          ...(patch.player2Name != null && { player2Name: patch.player2Name }),
          updatedAt: new Date(),
        });
      }
    }

    return 1;
  };

  const handleGenerate = async () => {
    if (!form.startDateTime) {
      notify({ title: 'Missing date', description: 'Please enter a start date and time (IST).', variant: 'error' });
      return;
    }
    setGenerating(true);
    try {
      const totalCreated = generationMode === 'pool'
        ? await handleGeneratePool()
        : generationMode === 'knockout'
          ? await handleGenerateKnockout()
          : generationMode === 'ipl-playoff'
            ? await handleGenerateIplPlayoff()
            : await handleGenerateManual();

      if (totalCreated === 0) {
        const msg = generationMode === 'pool'
          ? 'Each pool needs at least 2 participants.'
          : generationMode === 'knockout'
            ? 'No knockout matches could be created. Check pool standings and prior rounds.'
            : generationMode === 'ipl-playoff'
              ? 'No IPL playoff matches could be created. Check pool standings and prior rounds.'
              : 'Select a pool and two different participants.';
        notify({ title: 'No matches created', description: msg, variant: 'error' });
      } else if (generationMode === 'manual') {
        invalidateTournament(tournament.id);
        const preview = getManualPreview();
        notify({
          title: 'Match created',
          description: preview
            ? `${getMemberDisplayLabel(preview.p1)} vs ${getMemberDisplayLabel(preview.p2)} added.`
            : 'Match added.',
          variant: 'success',
        });
        resetManualForm();
      } else {
        invalidateTournament(tournament.id);
        setStep(1);
        setSelectedCategory(null);
        setSelectedPoolId('all');
        setSetupMethod('auto');
        setMatchFormat('pool');
        setKnockoutRound('QF');
        setIplPlayoffRound('Qualifier1');
        resetManualForm();
        setManualPoolId('');
        onGenerated?.(totalCreated);
      }
    } catch (err) {
      notify({ title: 'Error', description: err instanceof Error ? err.message : 'Failed to generate matches.', variant: 'error' });
    } finally {
      setGenerating(false);
    }
  };

  const autoPoolPreview = setupMethod === 'auto' && matchFormat === 'pool' ? getPoolPreview() : null;
  const autoKnockoutPreview = setupMethod === 'auto' && matchFormat === 'knockout' ? getKnockoutPreview() : null;
  const autoIplPlayoffPreview = setupMethod === 'auto' && matchFormat === 'ipl-playoff' ? getIplPlayoffPreview() : null;
  const autoPreviewTotal = matchFormat === 'pool'
    ? (autoPoolPreview?.total ?? 0)
    : matchFormat === 'ipl-playoff'
      ? (autoIplPlayoffPreview?.pairings.length ?? 0)
      : (autoKnockoutPreview?.pairings.length ?? 0);

  const canGenerateAuto = setupMethod === 'auto'
    && !!form.startDateTime
    && autoPreviewTotal > 0
    && (matchFormat === 'pool'
      ? getCategoryPools(selectedCategory!).some(p => getPoolMembers(p).length >= 2)
      : true);

  const canCreateManual = setupMethod === 'manual'
    && !!manualPlayer1Id
    && !!manualPlayer2Id
    && manualPlayer1Id !== manualPlayer2Id
    && !!form.startDateTime
    && (isBracketFormat(matchFormat) || !!manualPoolId);

  const memberLabel = selectedCategory && isTeamCat(selectedCategory) ? 'team' : 'player';
  const memberLabelCap = memberLabel === 'team' ? 'Team' : 'Player';

  const handleManualCreate = async () => {
    if (!canCreateManual) return;
    await handleGenerate();
  };

  const handleAutoGenerate = async () => {
    if (!canGenerateAuto) return;
    await handleGenerate();
  };

  const renderAutoPreview = () => (
    <div className={cn(
      'rounded-xl border p-4',
      autoPreviewTotal === 0 ? 'border-amber-200 bg-amber-50' : 'border-blue-100 bg-blue-50',
    )}>
      {matchFormat === 'pool' && autoPoolPreview && (
        autoPreviewTotal === 0 ? (
          <div className="flex items-center gap-2 text-amber-700 text-sm">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>No matches can be created — pools need at least 2 participants each.</span>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-blue-900">
                {autoPreviewTotal} pool match{autoPreviewTotal !== 1 ? 'es' : ''} will be created
              </span>
            </div>
            <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {autoPoolPreview.byPool.map(p => (
                <div key={p.name} className="flex justify-between text-xs text-blue-800">
                  <span className="font-medium">{p.name}</span>
                  <span>{p.members} → {p.matches} match{p.matches !== 1 ? 'es' : ''}</span>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {matchFormat === 'knockout' && autoKnockoutPreview && (
        <>
          {autoKnockoutPreview.warnings.length > 0 && (
            <div className="mb-3 space-y-1">
              {autoKnockoutPreview.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-amber-700 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
          {autoPreviewTotal === 0 ? (
            <div className="text-sm text-amber-700">No knockout pairings available for {KNOCKOUT_ROUND_LABELS[knockoutRound]}.</div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-blue-900">
                  {autoPreviewTotal} {KNOCKOUT_ROUND_LABELS[knockoutRound]} match{autoPreviewTotal !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                {autoKnockoutPreview.pairings.map(p => (
                  <div key={p.matchNumber} className="text-xs text-blue-800 py-1 border-b border-blue-100 last:border-0">
                    <span className="font-medium">M{p.matchNumber}:</span>{' '}
                    {p.player1.name}
                    {p.player1.poolName && (
                      <span className="text-blue-600"> ({p.player1.poolName} #{p.player1.poolRank})</span>
                    )}
                    {' vs '}
                    {p.player2.name}
                    {p.player2.poolName && (
                      <span className="text-blue-600"> ({p.player2.poolName} #{p.player2.poolRank})</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {matchFormat === 'ipl-playoff' && autoIplPlayoffPreview && (
        <>
          {autoIplPlayoffPreview.warnings.length > 0 && (
            <div className="mb-3 space-y-1">
              {autoIplPlayoffPreview.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 text-amber-700 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}
          {autoPreviewTotal === 0 ? (
            <div className="text-sm text-amber-700">
              No IPL playoff pairings available for {IPL_PLAYOFF_ROUND_LABELS[iplPlayoffRound]}.
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 mb-3">
                <Medal className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-blue-900">
                  {autoPreviewTotal} {IPL_PLAYOFF_ROUND_LABELS[iplPlayoffRound]} match{autoPreviewTotal !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
                {autoIplPlayoffPreview.pairings.map(p => (
                  <div key={p.matchNumber} className="text-xs text-blue-800 py-1 border-b border-blue-100 last:border-0">
                    <span className="font-medium">M{p.matchNumber}:</span>{' '}
                    {p.player1.name}
                    {p.player1.poolRank != null && (
                      <span className="text-blue-600"> (#{p.player1.poolRank})</span>
                    )}
                    {' vs '}
                    {p.player2.name}
                    {p.player2.poolRank != null && (
                      <span className="text-blue-600"> (#{p.player2.poolRank})</span>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );

  const renderAutoSchedule = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
      <div className="space-y-1.5 sm:col-span-2">
        <Label className="text-xs font-medium text-gray-700">Start date &amp; time (IST)</Label>
        <DateTimePickerInput
          value={form.startDateTime}
          onChange={value => setForm(f => ({ ...f, startDateTime: value }))}
          triggerClassName="text-sm bg-white"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">Interval (minutes)</Label>
        <Input
          type="number"
          min="0"
          step="5"
          value={form.intervalMinutes}
          onChange={e => setForm(f => ({ ...f, intervalMinutes: e.target.value }))}
          className="h-9 text-sm bg-white"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-gray-700">Set / game format</Label>
        <Select
          value={form.matchFormat}
          onValueChange={v => setForm(f => ({ ...f, matchFormat: v as typeof form.matchFormat }))}
        >
          <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MATCH_FORMAT_SELECT_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

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

      {/* Step 1: Category */}
      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Choose a category</h3>
            <p className="text-xs text-gray-500 mt-0.5">Select the category for match generation.</p>
          </div>

          {poolsLoading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm">Loading pools…</div>
          ) : tournament.categories.length === 0 ? (
            <EmptyState message="No categories configured for this tournament." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {tournament.categories.map(cat => {
                const catPools = getCategoryPools(cat as CategoryType);
                const totalMembers = catPools.reduce((s, p) => s + (pools.find(x => x.id === p.id)?.teams.length ?? 0), 0);
                const isTeam = isTeamCat(cat as CategoryType);
                const selected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      setSelectedCategory(cat as CategoryType);
                      syncCategoryQualifyCount(cat as CategoryType);
                    }}
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
              disabled={!selectedCategory || getCategoryPools(selectedCategory!).length === 0}
              onClick={() => {
                setSelectedPoolId('all');
                const catPools = getCategoryPools(selectedCategory!);
                if (catPools.length > 0 && !manualPoolId) {
                  setManualPoolId(catPools[0].id);
                }
                if (catPools.length > 0) {
                  setIplPlayoffPoolId(catPools[0].id);
                }
                setStep(2);
              }}
            >
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 2: Setup */}
      {step === 2 && selectedCategory && (
        <div className="flex flex-col gap-5">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Match setup</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure how matches are created for{' '}
              <span className="font-medium text-gray-700">{label(selectedCategory)}</span>.
            </p>
          </div>

          {/* 1 — Auto vs Manual */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Creation mode</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <SegmentedOption
                selected={setupMethod === 'auto'}
                onClick={() => setSetupMethod('auto')}
                icon={Wand2}
                title="Auto"
                description="Bulk-generate many matches at once"
              />
              <SegmentedOption
                selected={setupMethod === 'manual'}
                onClick={() => {
                  setSetupMethod('manual');
                  const catPools = getCategoryPools(selectedCategory);
                  if (catPools.length > 0 && !manualPoolId) {
                    setManualPoolId(catPools[0].id);
                  }
                  resetManualForm();
                }}
                icon={Hand}
                title="Manual"
                description="Pick pool and players for one match"
              />
            </div>
          </div>

          {/* 2 — Pool play vs Knockout vs IPL Playoff (auto & manual) */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-gray-700 uppercase tracking-wide">Match format</Label>
            <div className="flex flex-col sm:flex-row gap-2">
              <SegmentedOption
                selected={matchFormat === 'pool'}
                onClick={() => {
                  setMatchFormat('pool');
                  resetManualForm();
                }}
                icon={Swords}
                title="Pool play"
                description="Round-robin or pool-stage match"
              />
              <SegmentedOption
                selected={matchFormat === 'knockout'}
                onClick={() => {
                  setMatchFormat('knockout');
                  setManualKnockoutRound(knockoutRound);
                  setManualMatchRound(KNOCKOUT_PREV_ROUND[knockoutRound] ?? knockoutRound);
                  resetManualForm();
                }}
                icon={Trophy}
                title="Knockout"
                description="QF, SF, Final, Third Place"
              />
              <SegmentedOption
                selected={matchFormat === 'ipl-playoff'}
                onClick={() => {
                  setMatchFormat('ipl-playoff');
                  resetManualForm();
                }}
                icon={Medal}
                title="IPL Playoff"
                description="Q1, Eliminator, Q2, Final"
              />
            </div>
          </div>

          {/* Auto — Pool play options */}
          {setupMethod === 'auto' && matchFormat === 'pool' && (
            <div className="space-y-4">
              <div className="space-y-2 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
                <Label className="text-xs font-medium text-gray-700">Pools to include</Label>
                <div className="flex flex-col gap-2">
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
                        'flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all bg-white',
                        selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300',
                      )}
                    >
                      <Layers className={cn('h-4 w-4', selected ? 'text-blue-600' : 'text-gray-400')} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">All pools</div>
                        <div className="text-xs text-gray-500">{catPools.length} pools · {totalM} matches</div>
                      </div>
                      {selected && <Check className="h-4 w-4 text-blue-600" />}
                    </button>
                  );
                })()}
                {getCategoryPools(selectedCategory).map(pool => {
                  const members = getPoolMembers(pool);
                  const insufficient = members.length < 2;
                  const selected = selectedPoolId === pool.id;
                  return (
                    <button
                      key={pool.id}
                      type="button"
                      onClick={() => !insufficient && setSelectedPoolId(pool.id)}
                      disabled={insufficient}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border-2 p-3 text-left transition-all bg-white',
                        insufficient ? 'opacity-50 cursor-not-allowed border-gray-100' : selected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-blue-300',
                      )}
                    >
                      <span className={cn(
                        'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-xs font-bold',
                        selected ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600',
                      )}>
                        {pool.name.charAt(0).toUpperCase()}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{pool.name}</div>
                        <div className="text-xs text-gray-500">
                          {members.length} members
                          {!insufficient && <> · {matchCount(members.length)} matches</>}
                          {insufficient && <span className="text-amber-600"> · needs 2+</span>}
                        </div>
                      </div>
                      {selected && <Check className="h-4 w-4 text-blue-600" />}
                    </button>
                  );
                })}
                </div>
              </div>
              {renderAutoPreview()}
              {renderAutoSchedule()}
            </div>
          )}

          {/* Auto — Knockout options */}
          {setupMethod === 'auto' && matchFormat === 'knockout' && (
            <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Knockout round</Label>
                <Select value={knockoutRound} onValueChange={v => setKnockoutRound(v as KnockoutRound)}>
                  <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {getKnockoutRoundOptions().map(r => (
                      <SelectItem key={r} value={r}>{KNOCKOUT_ROUND_LABELS[r]} ({r})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Qualifiers per pool</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min="1"
                    max="8"
                    value={categoryQualifyCount}
                    onChange={e => setCategoryQualifyCount(e.target.value)}
                    className="h-9 w-24 text-sm bg-white"
                  />
                  <Button type="button" variant="outline" size="sm" onClick={saveCategoryQualifyCount}>
                    Save default
                  </Button>
                </div>
                <p className="text-xs text-gray-500">
                  Top N from each pool&apos;s standings qualify. Override per pool in Pool Assignment.
                </p>
              </div>
              {knockoutRound === 'KO' && (
                <p className="text-xs text-gray-500 rounded-lg bg-white border border-gray-100 p-3">
                  Preliminary knockout for fields larger than 8. Top seeds are paired (1 vs last, 2 vs second-last, etc.).
                </p>
              )}
              {knockoutRound === 'QF' && (
                <p className="text-xs text-gray-500 rounded-lg bg-white border border-gray-100 p-3">
                  Cross-pool pairing: Pool A #1 vs Pool B #2, Pool B #1 vs Pool C #2, and so on.
                </p>
              )}
              {renderAutoPreview()}
            </div>
          )}

          {setupMethod === 'auto' && matchFormat === 'knockout' && renderAutoSchedule()}

          {/* Auto — IPL Playoff options */}
          {setupMethod === 'auto' && matchFormat === 'ipl-playoff' && (
            <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/50 p-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">League pool</Label>
                <Select
                  value={iplPlayoffPoolId || getIplPlayoffPool()?.id || ''}
                  onValueChange={v => setIplPlayoffPoolId(v)}
                >
                  <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="Select pool" /></SelectTrigger>
                  <SelectContent>
                    {getCategoryPools(selectedCategory).map(pool => (
                      <SelectItem key={pool.id} value={pool.id}>
                        {pool.name} ({getPoolMembers(pool).length} {memberLabel}s)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Top 4 from this pool&apos;s points table qualify for IPL-style playoffs.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Playoff round</Label>
                <Select value={iplPlayoffRound} onValueChange={v => setIplPlayoffRound(v as IplPlayoffRound)}>
                  <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {IPL_PLAYOFF_ROUNDS.map(r => (
                      <SelectItem key={r} value={r}>{IPL_PLAYOFF_ROUND_LABELS[r]} ({r})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {iplPlayoffRound === 'Qualifier1' && (
                <p className="text-xs text-gray-500 rounded-lg bg-white border border-gray-100 p-3">
                  Qualifier 1: #1 vs #2 from the league table. Winner advances directly to the Final.
                </p>
              )}
              {iplPlayoffRound === 'Eliminator' && (
                <p className="text-xs text-gray-500 rounded-lg bg-white border border-gray-100 p-3">
                  Eliminator: #3 vs #4. Winner plays Qualifier 2; loser is eliminated.
                </p>
              )}
              {iplPlayoffRound === 'Qualifier2' && (
                <p className="text-xs text-gray-500 rounded-lg bg-white border border-gray-100 p-3">
                  Qualifier 2: Loser of Qualifier1 vs Winner of Eliminator. Winner advances to the Final.
                </p>
              )}
              {iplPlayoffRound === 'F' && (
                <p className="text-xs text-gray-500 rounded-lg bg-white border border-gray-100 p-3">
                  Final: Winner of Qualifier1 vs Winner of Qualifier2.
                </p>
              )}
              {renderAutoPreview()}
            </div>
          )}

          {setupMethod === 'auto' && matchFormat === 'ipl-playoff' && renderAutoSchedule()}

          {/* Manual — pool + player dropdowns */}
          {setupMethod === 'manual' && (
            <div className="space-y-4 rounded-xl border border-green-200 bg-green-50/30 p-4">
              {matchFormat === 'knockout' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Knockout type</Label>
                    <Select
                      value={manualKnockoutRound}
                      onValueChange={v => {
                        const knockoutType = v as KnockoutRound;
                        setManualKnockoutRound(knockoutType);
                        setKnockoutRound(knockoutType);
                        const rounds = getCategoryMatchRounds();
                        const prevRound = KNOCKOUT_PREV_ROUND[knockoutType];
                        const sourceRound = prevRound
                          ? (rounds.find(r => r.round === prevRound)?.round ?? prevRound)
                          : (rounds[0]?.round ?? knockoutType);
                        setManualMatchRound(sourceRound);
                        resetManualForm();
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {getKnockoutRoundOptions().map(r => (
                          <SelectItem key={r} value={r}>
                            {KNOCKOUT_ROUND_LABELS[r]} ({r})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Round</Label>
                    <Select
                      value={getActiveMatchRound()}
                      onValueChange={v => {
                        setManualMatchRound(v);
                        resetManualForm();
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="Select round…" /></SelectTrigger>
                      <SelectContent>
                        {getMatchRoundSelectOptions().map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500">
                      Pick the source round — player options show its winners, or estimated winners if not yet played.
                    </p>
                  </div>
                </div>
              )}

              {matchFormat === 'knockout' && getKnockoutRoundOptions().includes('KO') && manualKnockoutRound !== 'KO' && (
                <p className="text-xs text-gray-500 rounded-lg bg-white border border-gray-100 p-3">
                  More than 8 players qualify — use the Knockout round first, then Quarter Finals from winners.
                </p>
              )}

              {matchFormat === 'ipl-playoff' && (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">League pool</Label>
                    <Select
                      value={iplPlayoffPoolId || getIplPlayoffPool()?.id || ''}
                      onValueChange={v => {
                        setIplPlayoffPoolId(v);
                        resetManualForm();
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="Select pool" /></SelectTrigger>
                      <SelectContent>
                        {getCategoryPools(selectedCategory).map(pool => (
                          <SelectItem key={pool.id} value={pool.id}>
                            {pool.name} ({getPoolMembers(pool).length} {memberLabel}s)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-gray-700">Playoff round</Label>
                    <Select
                      value={iplPlayoffRound}
                      onValueChange={v => {
                        setIplPlayoffRound(v as IplPlayoffRound);
                        resetManualForm();
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {IPL_PLAYOFF_ROUNDS.map(r => (
                          <SelectItem key={r} value={r}>{IPL_PLAYOFF_ROUND_LABELS[r]} ({r})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {matchFormat === 'pool' && (
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-medium text-gray-700">Round (pool)</Label>
                    <Select
                      value={manualPoolId}
                      onValueChange={v => {
                        setManualPoolId(v);
                        resetManualForm();
                      }}
                    >
                      <SelectTrigger className="h-9 text-sm bg-white"><SelectValue placeholder="Select pool" /></SelectTrigger>
                      <SelectContent>
                        {getCategoryPools(selectedCategory).map(pool => (
                          <SelectItem key={pool.id} value={pool.id}>
                            {pool.name} ({getPoolMembers(pool).length} {memberLabel}s)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <MemberSelectField
                  label={`${memberLabelCap} 1`}
                  value={manualPlayer1Id}
                  onChange={setManualPlayer1Id}
                  members={getManualMembers().filter(m => m.id !== manualPlayer2Id)}
                  disabled={matchFormat === 'pool' ? !manualPoolId : getManualMembers().length === 0}
                  memberLabel={memberLabel}
                  includePoolName={matchFormat === 'knockout'}
                  getDisplayLabel={getMemberDisplayLabel}
                />

                <MemberSelectField
                  label={`${memberLabelCap} 2`}
                  value={manualPlayer2Id}
                  onChange={setManualPlayer2Id}
                  members={getManualMembers().filter(m => m.id !== manualPlayer1Id)}
                  disabled={matchFormat === 'pool' ? !manualPoolId : getManualMembers().length === 0}
                  memberLabel={memberLabel}
                  includePoolName={matchFormat === 'knockout'}
                  getDisplayLabel={getMemberDisplayLabel}
                />
              </div>

              {matchFormat === 'knockout' && (() => {
                const knockoutCode = manualKnockoutRound;
                const sourceRound = getActiveMatchRound();
                const members = getManualMembers();
                const slotMembers = members.filter((m): m is SlotMember => 'slotLabel' in m && !!m.slotLabel);
                const hasKoForQf = knockoutCode === 'QF'
                  && selectedCategory
                  && filterKnockoutMatchesForCategory(matches, 'KO', selectedCategory).length > 0;
                const prevRoundLabel = knockoutCode === 'QF'
                  ? (hasKoForQf ? 'KO' : null)
                  : knockoutCode === 'SF'
                    ? 'QF'
                    : knockoutCode === 'TP'
                      ? 'SF'
                      : knockoutCode === 'F'
                        ? 'SF'
                        : null;
                if (knockoutCode === 'KO' && slotMembers.length === 0) {
                  return (
                    <p className="text-xs text-gray-600">
                      Pick from pool-qualified {memberLabel}s (top N from each pool&apos;s standings), or select a round with existing matches above.
                    </p>
                  );
                }
                if (slotMembers.length === 0) {
                  return (
                    <p className="text-xs text-amber-600">
                      No matches in &quot;{sourceRound}&quot;. Generate {prevRoundLabel ?? sourceRound} first, or pick {memberLabel}s manually.
                    </p>
                  );
                }
                const resolvedCount = slotMembers.filter(s => s.isResolved).length;
                return (
                  <p className="text-xs text-gray-600">
                    {resolvedCount === slotMembers.length
                      ? `${knockoutCode === 'TP' ? 'Losers' : 'Winners'} from ${sourceRound} — ${resolvedCount} available to pick.`
                      : `${resolvedCount}/${slotMembers.length} results in ${sourceRound} — remaining show as estimated winners (e.g. Winner of QF1).`}
                  </p>
                );
              })()}
              {matchFormat === 'ipl-playoff' && (() => {
                const slots = getIplPreviousRoundSlots();
                if (iplPlayoffRound === 'Qualifier1' || iplPlayoffRound === 'Eliminator') {
                  return (
                    <p className="text-xs text-gray-600">
                      Pick #1 vs #2 (Qualifier1) or #3 vs #4 (Eliminator) from the league table standings.
                    </p>
                  );
                }
                if (!slots) {
                  const need = iplPlayoffRound === 'Qualifier2'
                    ? 'Qualifier1 and Eliminator'
                    : 'Qualifier1 and Qualifier2';
                  return <p className="text-xs text-amber-600">Complete {need} first to auto-fill participants.</p>;
                }
                const resolvedCount = slots.filter(s => s.isResolved).length;
                return (
                  <p className="text-xs text-gray-600">
                    {resolvedCount === slots.length
                      ? 'Participants auto-filled from prior playoff results.'
                      : `${resolvedCount}/${slots.length} prior match${slots.length !== 1 ? 'es' : ''} completed — remaining slots are TBD.`}
                  </p>
                );
              })()}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-green-200/80">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Scheduled time (IST)</Label>
                  <DateTimePickerInput
                    value={form.startDateTime}
                    onChange={value => setForm(f => ({ ...f, startDateTime: value }))}
                    triggerClassName="text-sm bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700">Set / game format</Label>
                  <Select
                    value={form.matchFormat}
                    onValueChange={v => setForm(f => ({ ...f, matchFormat: v as typeof form.matchFormat }))}
                  >
                    <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MATCH_FORMAT_SELECT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-medium text-gray-700">
                    Match no. <span className="text-gray-400 font-normal">(optional — auto-assigned if blank)</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="e.g. 5, QF3, M12…"
                    value={manualMatchNo}
                    onChange={e => setManualMatchNo(e.target.value)}
                    className="h-9 text-sm bg-white"
                  />
                </div>
              </div>

              {manualPlayer1Id && manualPlayer2Id && manualPlayer1Id === manualPlayer2Id && (
                <div className="flex items-center gap-2 text-amber-700 text-xs">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Select two different {memberLabel}s.
                </div>
              )}

              {getManualPreview() && (() => {
                const preview = getManualPreview()!;
                return (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900">
                    <div>
                      <span className="font-semibold">{getMemberDisplayLabel(preview.p1)}</span>
                      {' vs '}
                      <span className="font-semibold">{getMemberDisplayLabel(preview.p2)}</span>
                    </div>
                    <span className="text-xs text-blue-700 block mt-0.5">
                      {matchFormat === 'knockout'
                        ? `${KNOCKOUT_ROUND_LABELS[manualKnockoutRound]} (${manualKnockoutRound}) · from ${getActiveMatchRound()}`
                        : matchFormat === 'ipl-playoff'
                          ? `${IPL_PLAYOFF_ROUND_LABELS[iplPlayoffRound]} (${iplPlayoffRound})`
                          : preview.pool?.name}
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          <div className="flex justify-between pt-1 border-t border-gray-100">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            {setupMethod === 'manual' ? (
              <Button
                onClick={handleManualCreate}
                disabled={generating || !canCreateManual}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                {generating ? 'Creating…' : 'Create match'}
              </Button>
            ) : (
              <Button
                onClick={handleAutoGenerate}
                disabled={generating || !canGenerateAuto}
                className="gap-2"
              >
                {matchFormat === 'knockout' ? (
                  <Trophy className="h-4 w-4" />
                ) : matchFormat === 'ipl-playoff' ? (
                  <Medal className="h-4 w-4" />
                ) : (
                  <Swords className="h-4 w-4" />
                )}
                {generating
                  ? 'Generating…'
                  : `Generate ${autoPreviewTotal} match${autoPreviewTotal !== 1 ? 'es' : ''}`}
              </Button>
            )}
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
