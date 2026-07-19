import { NextResponse } from 'next/server';
import { type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { getAdminFirestore, isAdminConfigured } from '@/lib/firebase-admin';

type RouteContext = { params: Promise<{ id: string }> };

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

function includesParticipant(data: DocumentData, name: string, phone: string) {
  const n = normalizeName(name);
  const p = normalizePhone(phone);
  if (!n || !p) return false;
  const asPrimary =
    normalizeName(String(data.name || '')) === n && normalizePhone(String(data.phone || '')) === p;
  const asPartner =
    normalizeName(String(data.partnerName || '')) === n &&
    normalizePhone(String(data.partnerPhone || '')) === p;
  return asPrimary || asPartner;
}

async function statsFor(
  db: Firestore,
  tournamentId: string,
  name: string,
  phone: string
) {
  const regRef = db.collection('tournaments').doc(tournamentId).collection('registrations');
  const phoneTrim = phone.trim();
  const [primarySnap, partnerSnap] = await Promise.all([
    regRef.where('phone', '==', phoneTrim).get(),
    regRef.where('partnerPhone', '==', phoneTrim).get(),
  ]);
  const map = new Map<string, DocumentData>();
  primarySnap.docs.forEach((d) => map.set(d.id, d.data()));
  partnerSnap.docs.forEach((d) => map.set(d.id, d.data()));

  const matching = Array.from(map.values()).filter(
    (data) => includesParticipant(data, name, phone) && data.registrationStatus !== 'rejected'
  );

  let profilePhotoUrl: string | null = null;
  for (const data of matching) {
    if (normalizeName(String(data.name || '')) === normalizeName(name) && data.profilePhotoUrl) {
      profilePhotoUrl = String(data.profilePhotoUrl);
      break;
    }
    if (
      normalizeName(String(data.partnerName || '')) === normalizeName(name) &&
      data.partnerProfilePhotoUrl
    ) {
      profilePhotoUrl = String(data.partnerProfilePhotoUrl);
      break;
    }
  }

  return { count: matching.length, profilePhotoUrl };
}

/** Public-safe registration count for fee / limit UI (no PII list). */
export async function GET(request: Request, context: RouteContext) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: 'Server admin is not configured' }, { status: 503 });
    }

    const { id: tournamentId } = await context.params;
    const { searchParams } = new URL(request.url);
    const name = (searchParams.get('name') || '').trim();
    const phone = (searchParams.get('phone') || '').trim();

    if (!tournamentId || !name || !phone) {
      return NextResponse.json({ count: 0, profilePhotoUrl: null });
    }

    const result = await statsFor(getAdminFirestore(), tournamentId, name, phone);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Error loading registration stats:', error);
    return NextResponse.json({ count: 0, profilePhotoUrl: null });
  }
}
