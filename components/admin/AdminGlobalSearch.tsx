'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { Search, Trophy, Users, UserPlus, MessageSquareQuote, LayoutDashboard, Loader2 } from 'lucide-react';
import { db } from '@/lib/firebase';
import {
  canAccessTournamentConsole,
  canReviewTestimonials,
  canSubmitTestimonials,
  isSystemAdmin,
} from '@/lib/permissions';
import {
  SEARCH_TYPE_LABELS,
  expandTournamentActions,
  groupSearchResults,
  rankSearchItems,
  type AdminSearchItem,
} from '@/lib/admin-search';
import type { User } from '@/types';
import { cn } from '@/lib/utils';

type SearchIndex = {
  items: AdminSearchItem[];
  tournaments: Array<{ id: string; name: string; sport?: string; venue?: string }>;
};

let cachedIndex: SearchIndex | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 60_000;

function toDate(value: unknown): Date | undefined {
  if (value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return undefined;
}

function adminPages(user: User | null | undefined): AdminSearchItem[] {
  if (!user) return [];

  const pages: AdminSearchItem[] = [];
  if (isSystemAdmin(user.role)) {
    pages.push({
      id: 'page-dashboard',
      type: 'page',
      title: 'Dashboard',
      subtitle: 'Overview and attention queue',
      href: '/admin',
      keywords: 'home overview stats',
    });
  }
  if (canAccessTournamentConsole(user)) {
    pages.push({
      id: 'page-tournaments',
      type: 'page',
      title: 'Tournaments',
      subtitle: 'Create and manage tournaments',
      href: '/admin/tournaments',
      keywords: 'events sports',
    });
  }
  if (isSystemAdmin(user.role)) {
    pages.push(
      {
        id: 'page-users',
        type: 'page',
        title: 'User Management',
        subtitle: 'Admins, staff, and permissions',
        href: '/admin/users',
        keywords: 'staff accounts roles',
      },
      {
        id: 'page-leads',
        type: 'page',
        title: 'Leads',
        subtitle: 'Host tournament requests',
        href: '/admin/leads',
        keywords: 'host requests inquiries',
      },
      {
        id: 'page-settings',
        type: 'page',
        title: 'Settings',
        subtitle: 'Sports, categories, and roles',
        href: '/admin/settings',
        keywords: 'system preferences configuration',
      }
    );
  }
  if (user.role === 'super-admin') {
    pages.push({
      id: 'page-activity',
      type: 'page',
      title: 'User Activity',
      subtitle: 'Logins and engagement',
      href: '/admin/user-activity',
      keywords: 'audit log timeline',
    });
  }
  if (canReviewTestimonials(user) || canSubmitTestimonials(user)) {
    pages.push({
      id: 'page-testimonials',
      type: 'page',
      title: 'Testimonials',
      subtitle: 'Public site reviews',
      href: '/admin/testimonials',
      keywords: 'quotes reviews',
    });
  }
  return pages;
}

async function loadSearchIndex(user: User): Promise<SearchIndex> {
  if (cachedIndex && Date.now() - cacheLoadedAt < CACHE_TTL_MS) {
    return cachedIndex;
  }

  const assignedIds = user.assignedTournaments ?? [];
  const canSeeAllTournaments = isSystemAdmin(user.role) || user.role === 'tournament-admin';

  const [tournamentsSnap, usersSnap, leadsSnap, testimonialsSnap] = await Promise.all([
    getDocs(query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'))),
    isSystemAdmin(user.role)
      ? getDocs(collection(db, 'users'))
      : Promise.resolve(null),
    isSystemAdmin(user.role)
      ? getDocs(collection(db, 'tournamentLeads'))
      : Promise.resolve(null),
    canReviewTestimonials(user) || canSubmitTestimonials(user)
      ? getDocs(collection(db, 'testimonials'))
      : Promise.resolve(null),
  ]);

  const tournaments = tournamentsSnap.docs
    .map((docSnap) => {
      const data = docSnap.data();
      return {
        id: docSnap.id,
        name: String(data.name ?? 'Untitled tournament'),
        sport: typeof data.sport === 'string' ? data.sport : undefined,
        venue: typeof data.venue === 'string' ? data.venue : undefined,
        status: typeof data.status === 'string' ? data.status : undefined,
        createdAt: toDate(data.createdAt),
      };
    })
    .filter((tournament) => canSeeAllTournaments || assignedIds.includes(tournament.id));

  const items: AdminSearchItem[] = tournaments.map((tournament) => ({
    id: `tournament-${tournament.id}`,
    type: 'tournament',
    title: tournament.name,
    subtitle: [tournament.sport?.replace('-', ' '), tournament.venue, tournament.status]
      .filter(Boolean)
      .join(' · '),
    href: `/admin/tournaments/${tournament.id}/overview`,
    keywords: `${tournament.name} ${tournament.sport ?? ''} ${tournament.venue ?? ''} ${tournament.status ?? ''}`,
  }));

  if (usersSnap) {
    for (const docSnap of usersSnap.docs) {
      const data = docSnap.data();
      const name = String(data.name ?? 'User');
      const email = String(data.email ?? '');
      items.push({
        id: `user-${docSnap.id}`,
        type: 'user',
        title: name,
        subtitle: [email, data.role].filter(Boolean).join(' · '),
        href: `/admin/users?q=${encodeURIComponent(email || name)}`,
        keywords: `${name} ${email} ${data.role ?? ''}`,
      });
    }
  }

  if (leadsSnap) {
    for (const docSnap of leadsSnap.docs) {
      const data = docSnap.data();
      const name = String(data.name ?? 'Lead');
      const email = String(data.email ?? '');
      const tournamentName = String(data.tournamentName ?? '');
      items.push({
        id: `lead-${docSnap.id}`,
        type: 'lead',
        title: name,
        subtitle: [tournamentName || data.sport, email, data.status].filter(Boolean).join(' · '),
        href: `/admin/leads?q=${encodeURIComponent(email || name)}`,
        keywords: `${name} ${email} ${tournamentName} ${data.sport ?? ''} ${data.organisation ?? ''} ${data.status ?? ''}`,
      });
    }
  }

  if (testimonialsSnap) {
    for (const docSnap of testimonialsSnap.docs) {
      const data = docSnap.data();
      const author = String(data.author ?? 'Testimonial');
      const tournamentName = String(data.tournamentName ?? '');
      items.push({
        id: `testimonial-${docSnap.id}`,
        type: 'testimonial',
        title: author,
        subtitle: [tournamentName, data.published ? 'Published' : 'Pending review'].filter(Boolean).join(' · '),
        href: `/admin/testimonials?q=${encodeURIComponent(author)}`,
        keywords: `${author} ${tournamentName} ${data.quote ?? ''} ${data.sport ?? ''}`,
      });
    }
  }

  const index = {
    items,
    tournaments: tournaments.map(({ id, name, sport, venue }) => ({ id, name, sport, venue })),
  };
  cachedIndex = index;
  cacheLoadedAt = Date.now();
  return index;
}

function ResultIcon({ type }: { type: AdminSearchItem['type'] }) {
  const className = 'h-3.5 w-3.5 text-slate-400';
  switch (type) {
    case 'tournament':
    case 'match':
      return <Trophy className={className} />;
    case 'user':
      return <Users className={className} />;
    case 'lead':
      return <UserPlus className={className} />;
    case 'testimonial':
      return <MessageSquareQuote className={className} />;
    default:
      return <LayoutDashboard className={className} />;
  }
}

export function AdminGlobalSearch({ user }: { user: User | null | undefined }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [queryText, setQueryText] = useState('');
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [index, setIndex] = useState<SearchIndex | null>(cachedIndex);

  const ensureIndex = useCallback(async () => {
    if (!user) return;
    if (index && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return;
    setLoading(true);
    try {
      const next = await loadSearchIndex(user);
      setIndex(next);
    } catch (error) {
      console.warn('Failed to load admin search index:', error);
    } finally {
      setLoading(false);
    }
  }, [user, index]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setMobileOpen(true);
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
        void ensureIndex();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [ensureIndex]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setMobileOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, []);

  const results = useMemo(() => {
    if (!queryText.trim()) return [];
    const pages = adminPages(user);
    const catalog = [...pages, ...(index?.items ?? [])];
    const extras = index ? expandTournamentActions(index.tournaments, queryText) : [];
    return rankSearchItems([...catalog, ...extras], queryText);
  }, [index, queryText, user]);

  const grouped = useMemo(() => groupSearchResults(results), [results]);

  const goTo = (href: string) => {
    setOpen(false);
    setMobileOpen(false);
    setQueryText('');
    router.push(href);
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(results.length - 1, 0)));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const selected = results[activeIndex];
      if (selected) {
        goTo(selected.href);
      } else if (queryText.trim()) {
        goTo(`/admin/tournaments?q=${encodeURIComponent(queryText.trim())}`);
      }
    } else if (event.key === 'Escape') {
      setOpen(false);
      setMobileOpen(false);
      inputRef.current?.blur();
    }
  };

  const showPanel = open && (queryText.trim().length > 0 || loading);

  const searchField = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={inputRef}
        type="search"
        value={queryText}
        onChange={(event) => {
          setQueryText(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          void ensureIndex();
        }}
        onKeyDown={onKeyDown}
        placeholder="Search tournaments, users, leads…"
        className="h-9 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-14 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls="admin-global-search-results"
        aria-autocomplete="list"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 hidden -translate-y-1/2 rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">
        ⌘K
      </kbd>
    </div>
  );

  const resultsPanel = showPanel ? (
    <div
      id="admin-global-search-results"
      role="listbox"
      className="absolute right-0 z-50 mt-2 max-h-80 w-full overflow-auto rounded-xl border border-slate-200 bg-white py-1.5 shadow-lg sm:w-[28rem]"
    >
      {loading && !index ? (
        <div className="flex items-center gap-2 px-3 py-3 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading search…
        </div>
      ) : results.length === 0 ? (
        <p className="px-3 py-3 text-sm text-slate-500">No matches for “{queryText.trim()}”</p>
      ) : (
        grouped.map((group) => (
          <div key={group.type} className="py-1">
            <p className="px-3 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {SEARCH_TYPE_LABELS[group.type]}
            </p>
            {group.items.map((item) => {
              const flatIndex = results.findIndex((result) => result.id === item.id);
              const active = flatIndex === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={cn(
                    'flex w-full items-start gap-2.5 px-3 py-2 text-left',
                    active ? 'bg-slate-100' : 'hover:bg-slate-50'
                  )}
                  onMouseEnter={() => setActiveIndex(flatIndex)}
                  onClick={() => goTo(item.href)}
                >
                  <span className="mt-0.5">
                    <ResultIcon type={item.type} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{item.title}</span>
                    {item.subtitle && (
                      <span className="block truncate text-xs text-slate-500">{item.subtitle}</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  ) : null;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
        onClick={() => {
          setMobileOpen((current) => !current);
          setOpen(true);
          void ensureIndex();
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
        aria-label="Search"
      >
        <Search className="h-4 w-4" />
      </button>

      <div
        className={
          mobileOpen
            ? 'absolute right-0 top-11 z-50 w-[min(calc(100vw-2rem),24rem)] md:static md:top-auto md:w-64 lg:w-80'
            : 'hidden md:block w-64 lg:w-80'
        }
      >
        {searchField}
        {resultsPanel}
      </div>
    </div>
  );
}
