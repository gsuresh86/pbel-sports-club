export type AdminSearchType =
  | 'page'
  | 'tournament'
  | 'user'
  | 'lead'
  | 'testimonial'
  | 'match';

export interface AdminSearchItem {
  id: string;
  type: AdminSearchType;
  title: string;
  subtitle?: string;
  href: string;
  keywords: string;
}

export const SEARCH_TYPE_LABELS: Record<AdminSearchType, string> = {
  page: 'Pages',
  tournament: 'Tournaments',
  match: 'Matches',
  user: 'Users',
  lead: 'Leads',
  testimonial: 'Testimonials',
};

const TYPE_ORDER: AdminSearchType[] = [
  'page',
  'tournament',
  'match',
  'user',
  'lead',
  'testimonial',
];

export function scoreSearchItem(item: AdminSearchItem, rawQuery: string): number {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 0;

  const title = item.title.toLowerCase();
  const subtitle = (item.subtitle ?? '').toLowerCase();
  const keywords = item.keywords.toLowerCase();

  if (title === q) return 100;
  if (title.startsWith(q)) return 90;
  if (title.includes(q)) return 75;
  if (subtitle.startsWith(q)) return 60;
  if (subtitle.includes(q)) return 50;
  if (keywords.includes(q)) return 40;

  const tokens = q.split(/\s+/).filter(Boolean);
  if (
    tokens.length > 1 &&
    tokens.every((token) => title.includes(token) || subtitle.includes(token) || keywords.includes(token))
  ) {
    return 35;
  }

  return 0;
}

export function rankSearchItems(items: AdminSearchItem[], rawQuery: string, limit = 12): AdminSearchItem[] {
  return items
    .map((item) => ({ item, score: scoreSearchItem(item, rawQuery) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
    .slice(0, limit)
    .map((entry) => entry.item);
}

export function groupSearchResults(items: AdminSearchItem[]): { type: AdminSearchType; items: AdminSearchItem[] }[] {
  return TYPE_ORDER
    .map((type) => ({ type, items: items.filter((item) => item.type === type) }))
    .filter((group) => group.items.length > 0);
}

export function expandTournamentActions(
  tournaments: Array<{ id: string; name: string; sport?: string; venue?: string }>,
  rawQuery: string
): AdminSearchItem[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];

  const actions = [
    {
      keys: ['reg', 'participant', 'player', 'entry'],
      label: 'Registrations',
      href: (id: string) => `/admin/tournaments/${id}/participants`,
    },
    {
      keys: ['match', 'score', 'live', 'fixture'],
      label: 'Matches',
      href: (id: string) => `/admin/tournaments/${id}/matches`,
    },
    {
      keys: ['finance', 'payment', 'revenue', 'fee'],
      label: 'Finance',
      href: (id: string) => `/admin/tournaments/${id}/finance`,
    },
  ] as const;

  const matchedActions = actions.filter((action) => action.keys.some((key) => q.includes(key)));
  if (matchedActions.length === 0) return [];

  return tournaments.flatMap((tournament) => {
    const haystack = `${tournament.name} ${tournament.sport ?? ''} ${tournament.venue ?? ''}`.toLowerCase();
    const mentionsTournament =
      haystack.includes(q.replace(/registrations?|participants?|players?|entries|matches?|scores?|live|fixtures?|finance|payments?|revenue|fees?/g, '').trim()) ||
      tournament.name.toLowerCase().split(/\s+/).some((token) => token.length > 2 && q.includes(token));

    if (!mentionsTournament) return [];

    return matchedActions.map((action) => ({
      id: `${tournament.id}-${action.label.toLowerCase()}`,
      type: 'page' as const,
      title: `${tournament.name} · ${action.label}`,
      subtitle: action.label,
      href: action.href(tournament.id),
      keywords: `${tournament.name} ${action.label} ${action.keys.join(' ')}`,
    }));
  });
}
