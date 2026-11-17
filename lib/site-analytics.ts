export const SITE_ANALYTICS_COLLECTION = 'siteAnalytics';
export const SITE_ANALYTICS_SUMMARY_ID = 'summary';

export interface SiteAnalyticsSummary {
  totalPageViews: number;
  totalUniqueVisitors: number;
  updatedAt?: Date;
}

export interface SiteAnalyticsDaily {
  date: string;
  pageViews: number;
  uniqueVisitors: number;
  pathCounts?: Record<string, number>;
  updatedAt?: Date;
}

export interface SiteVisitStats {
  todayPageViews: number;
  todayUniqueVisitors: number;
  weekPageViews: number;
  weekUniqueVisitors: number;
  totalPageViews: number;
  totalUniqueVisitors: number;
}

export const emptySiteVisitStats: SiteVisitStats = {
  todayPageViews: 0,
  todayUniqueVisitors: 0,
  weekPageViews: 0,
  weekUniqueVisitors: 0,
  totalPageViews: 0,
  totalUniqueVisitors: 0,
};

/** YYYY-MM-DD in local time */
export function analyticsDateKey(date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dailyAnalyticsDocId(dateKey: string): string {
  return `daily_${dateKey}`;
}

export function lastNDateKeys(n: number, from = new Date()): string[] {
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(from);
    d.setDate(from.getDate() - i);
    keys.push(analyticsDateKey(d));
  }
  return keys;
}

export function normalizeAnalyticsPath(pathname: string): string {
  if (!pathname || pathname === '/') return '/';
  const trimmed = pathname.replace(/\/+$/, '') || '/';
  return trimmed.slice(0, 120);
}

export function shouldTrackPath(pathname: string): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/admin')) return false;
  if (pathname.startsWith('/api')) return false;
  if (pathname.startsWith('/login')) return false;
  if (pathname.startsWith('/signup')) return false;
  return true;
}
