'use client';

import { useEffect, useRef } from 'react';
import Script from 'next/script';
import { usePathname, useSearchParams } from 'next/navigation';
import { normalizeAnalyticsPath, shouldTrackPath } from '@/lib/site-analytics';

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
const VISITOR_KEY = 'tc_vid';
const EVER_KEY = 'tc_vid_ever';
const DAY_KEY_PREFIX = 'tc_vid_day:';

function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing && existing.length >= 8) return existing;
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID().replace(/-/g, '')
        : `v${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    return `anon${Date.now().toString(36)}`;
  }
}

function consumeVisitorFlags(dateKey: string): { isNewVisitorToday: boolean; isNewVisitorEver: boolean } {
  try {
    const dayKey = `${DAY_KEY_PREFIX}${dateKey}`;
    const isNewVisitorToday = !localStorage.getItem(dayKey);
    if (isNewVisitorToday) localStorage.setItem(dayKey, '1');

    const isNewVisitorEver = !localStorage.getItem(EVER_KEY);
    if (isNewVisitorEver) localStorage.setItem(EVER_KEY, '1');

    return { isNewVisitorToday, isNewVisitorEver };
  } catch {
    return { isNewVisitorToday: true, isNewVisitorEver: true };
  }
}

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function trackGaPageView(path: string) {
  if (!GA_ID || typeof window.gtag !== 'function') return;
  window.gtag('config', GA_ID, { page_path: path });
}

async function recordVisit(path: string) {
  const visitorId = getOrCreateVisitorId();
  const { isNewVisitorToday, isNewVisitorEver } = consumeVisitorFlags(todayKey());
  try {
    await fetch('/api/analytics/visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, visitorId, isNewVisitorToday, isNewVisitorEver }),
      keepalive: true,
    });
  } catch {
    // Ignore network errors — analytics must never break the site
  }
}

function VisitTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastTracked = useRef<{ path: string; at: number }>({ path: '', at: 0 });

  useEffect(() => {
    if (!pathname || !shouldTrackPath(pathname)) return;

    const path = normalizeAnalyticsPath(pathname);
    const query = searchParams?.toString();
    const fullPath = query ? `${path}?${query}` : path;

    // Dedupe React Strict Mode double-mount / identical remounts
    const now = Date.now();
    if (lastTracked.current.path === fullPath && now - lastTracked.current.at < 1500) return;
    lastTracked.current = { path: fullPath, at: now };

    trackGaPageView(fullPath);
    void recordVisit(path);
  }, [pathname, searchParams]);

  return null;
}

export function SiteAnalytics() {
  return (
    <>
      {GA_ID ? (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${GA_ID}', { send_page_view: false });
            `}
          </Script>
        </>
      ) : null}
      <VisitTracker />
    </>
  );
}
