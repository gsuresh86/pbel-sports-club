import type { Tournament } from '@/types';

type TournamentBannerSource = Pick<Tournament, 'banner' | 'sport'> | Record<string, unknown> | null | undefined;

export function extractUploadedBanner(tournament: TournamentBannerSource): string | undefined {
  if (!tournament || typeof tournament !== 'object') return undefined;
  const banner = tournament.banner;
  if (typeof banner === 'string' && banner.trim()) return banner.trim();
  return undefined;
}

export function scoreboardPath(matchId: string, tournamentId?: string | null): string {
  const id = tournamentId?.trim();
  if (!id) return `/scoreboard/${matchId}`;
  return `/scoreboard/${matchId}?tournamentId=${encodeURIComponent(id)}`;
}

export function getSportBanner(sport: string): string {
  switch (sport) {
    case 'badminton':
      return 'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1600&h=600&q=80';
    case 'table-tennis':
      return 'https://images.unsplash.com/photo-1534158914592-062992fbe900?auto=format&fit=crop&w=1600&h=600&q=80';
    case 'volleyball':
      return 'https://images.unsplash.com/photo-1612872087720-b8768760e99a?auto=format&fit=crop&w=1600&h=600&q=80';
    default:
      return 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=1600&h=600&q=80';
  }
}

/** Uploaded tournament banner first; sport default when none is set. */
export function resolveTournamentBannerUrl(tournament: TournamentBannerSource): string {
  const uploaded = extractUploadedBanner(tournament);
  if (uploaded) return uploaded;
  const sport =
    tournament && typeof tournament === 'object' && typeof tournament.sport === 'string'
      ? tournament.sport
      : 'badminton';
  return getSportBanner(sport);
}
