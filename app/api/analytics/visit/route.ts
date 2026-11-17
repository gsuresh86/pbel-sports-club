import { NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore, isAdminConfigured } from '@/lib/firebase-admin';
import {
  SITE_ANALYTICS_COLLECTION,
  SITE_ANALYTICS_SUMMARY_ID,
  analyticsDateKey,
  dailyAnalyticsDocId,
  normalizeAnalyticsPath,
  shouldTrackPath,
} from '@/lib/site-analytics';

const VISITOR_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/;

export async function POST(request: Request) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ ok: false, skipped: true }, { status: 200 });
    }

    const body = (await request.json()) as {
      path?: string;
      visitorId?: string;
      isNewVisitorToday?: boolean;
      isNewVisitorEver?: boolean;
    };

    const path = normalizeAnalyticsPath(typeof body.path === 'string' ? body.path : '/');
    if (!shouldTrackPath(path)) {
      return NextResponse.json({ ok: false, skipped: true }, { status: 200 });
    }

    const visitorId = typeof body.visitorId === 'string' ? body.visitorId : '';
    if (!VISITOR_ID_RE.test(visitorId)) {
      return NextResponse.json({ error: 'Invalid visitorId' }, { status: 400 });
    }

    const isNewVisitorToday = Boolean(body.isNewVisitorToday);
    const isNewVisitorEver = Boolean(body.isNewVisitorEver);
    const dateKey = analyticsDateKey();
    const pathField = path.replace(/\./g, '_');

    const db = getAdminFirestore();
    const summaryRef = db.collection(SITE_ANALYTICS_COLLECTION).doc(SITE_ANALYTICS_SUMMARY_ID);
    const dailyRef = db.collection(SITE_ANALYTICS_COLLECTION).doc(dailyAnalyticsDocId(dateKey));

    const batch = db.batch();
    batch.set(
      summaryRef,
      {
        totalPageViews: FieldValue.increment(1),
        ...(isNewVisitorEver ? { totalUniqueVisitors: FieldValue.increment(1) } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    batch.set(
      dailyRef,
      {
        date: dateKey,
        pageViews: FieldValue.increment(1),
        ...(isNewVisitorToday ? { uniqueVisitors: FieldValue.increment(1) } : {}),
        [`pathCounts.${pathField}`]: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
    await batch.commit();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Visit analytics error:', error);
    return NextResponse.json({ error: 'Failed to record visit' }, { status: 500 });
  }
}
