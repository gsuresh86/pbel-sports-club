import { NextResponse } from 'next/server';
import { FieldValue, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { getAdminFirestore, isAdminConfigured } from '@/lib/firebase-admin';
import type { CategoryType } from '@/types';

type RouteContext = { params: Promise<{ id: string }> };

const DOUBLES: CategoryType[] = ['mens-doubles', 'womens-doubles', 'mixed-doubles', 'family-doubles'];

function calcPaymentAmount(
  tournament: { entryFee?: number; doublesFee?: number; repeatFee?: number },
  category: string,
  primaryCount: number,
  partnerCount: number
) {
  const doublesFee = tournament.doublesFee ?? 700;
  const repeatFee = tournament.repeatFee ?? 300;
  if (DOUBLES.includes(category as CategoryType)) {
    return (primaryCount > 0 ? repeatFee : doublesFee) + (partnerCount > 0 ? repeatFee : doublesFee);
  }
  if (primaryCount > 0) return repeatFee;
  return tournament.entryFee || 0;
}

function normalizeName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '');
}

function generateRegistrationCode() {
  return `R${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

function registrationIncludesParticipant(data: DocumentData, name: string, phone: string) {
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

function countsTowardLimit(data: DocumentData) {
  return data.registrationStatus !== 'rejected';
}

async function countParticipantRegs(
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
  return Array.from(map.values()).filter(
    (data) => registrationIncludesParticipant(data, name, phone) && countsTowardLimit(data)
  ).length;
}

function cleanData(data: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined && v !== null && v !== '')
  );
}

/**
 * Public registration create — validated server-side (deadline, capacity, duplicates).
 * Writes registration + publicPlayers + players via Admin SDK.
 * Client should call /api/notify-registration afterward with registrationId.
 */
export async function POST(request: Request, context: RouteContext) {
  try {
    if (!isAdminConfigured()) {
      return NextResponse.json({ error: 'Server admin is not configured' }, { status: 503 });
    }

    const { id: tournamentId } = await context.params;
    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament id is required' }, { status: 400 });
    }

    const body = (await request.json()) as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
    const selectedCategory = body.selectedCategory as CategoryType | undefined;

    if (!name || !email || !phone || !selectedCategory) {
      return NextResponse.json(
        { error: 'name, email, phone, and selectedCategory are required' },
        { status: 400 }
      );
    }

    const db = getAdminFirestore();
    const tournamentRef = db.collection('tournaments').doc(tournamentId);
    const tournamentSnap = await tournamentRef.get();
    if (!tournamentSnap.exists) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const tournament = tournamentSnap.data() ?? {};
    if (tournament.isPublic === false) {
      return NextResponse.json({ error: 'Tournament is not open for public registration' }, { status: 403 });
    }
    if (!tournament.registrationOpen) {
      return NextResponse.json({ error: 'Registration is closed for this tournament' }, { status: 400 });
    }

    const deadlineRaw = tournament.registrationDeadline;
    const deadline =
      deadlineRaw && typeof deadlineRaw.toDate === 'function'
        ? deadlineRaw.toDate()
        : deadlineRaw
          ? new Date(deadlineRaw)
          : null;
    if (deadline && !Number.isNaN(deadline.getTime()) && new Date() > deadline) {
      return NextResponse.json({ error: 'Registration deadline has passed' }, { status: 400 });
    }

    const maxParticipants = Number(tournament.maxParticipants ?? 0);
    const currentParticipants = Number(tournament.currentParticipants ?? 0);
    if (maxParticipants > 0 && currentParticipants >= maxParticipants) {
      return NextResponse.json({ error: 'Tournament is full' }, { status: 400 });
    }

    const categories = (tournament.categories as string[] | undefined) ?? [];
    if (categories.length > 0 && !categories.includes(selectedCategory)) {
      return NextResponse.json({ error: 'Selected category is not available' }, { status: 400 });
    }

    const limitPerParticipant = tournament.limitRegistrationsPerParticipant !== false;
    const maxPerParticipant = Number(tournament.maxRegistrationsPerParticipant ?? 3);

    const existingCount = await countParticipantRegs(db, tournamentId, name, phone);
    if (limitPerParticipant && existingCount >= maxPerParticipant) {
      return NextResponse.json(
        {
          error: `You have already registered for ${existingCount} categories. Each participant can register for at most ${maxPerParticipant} categories.`,
        },
        { status: 409 }
      );
    }

    const partnerName = typeof body.partnerName === 'string' ? body.partnerName.trim() : '';
    const partnerPhone = typeof body.partnerPhone === 'string' ? body.partnerPhone.trim() : '';
    let partnerExistingCount = 0;
    if (DOUBLES.includes(selectedCategory)) {
      if (!partnerName || !partnerPhone) {
        return NextResponse.json(
          { error: 'Partner name and phone are required for doubles categories' },
          { status: 400 }
        );
      }
      partnerExistingCount = await countParticipantRegs(db, tournamentId, partnerName, partnerPhone);
      if (limitPerParticipant && partnerExistingCount >= maxPerParticipant) {
        return NextResponse.json(
          {
            error: `Your partner has already registered for ${partnerExistingCount} categories. Each participant can register for at most ${maxPerParticipant} categories.`,
          },
          { status: 409 }
        );
      }
    }

    const paymentAmount = calcPaymentAmount(
      {
        entryFee: tournament.entryFee as number | undefined,
        doublesFee: tournament.doublesFee as number | undefined,
        repeatFee: tournament.repeatFee as number | undefined,
      },
      selectedCategory,
      existingCount,
      partnerExistingCount
    );

    const sameCategorySnap = await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('registrations')
      .where('phone', '==', phone)
      .where('selectedCategory', '==', selectedCategory)
      .get();
    const sameCategoryDup = sameCategorySnap.docs.some(
      (d) =>
        registrationIncludesParticipant(d.data(), name, phone) && countsTowardLimit(d.data())
    );
    if (sameCategoryDup) {
      return NextResponse.json(
        { error: 'You are already registered in this category' },
        { status: 409 }
      );
    }

    const registrationCode = generateRegistrationCode();
    const registrationData = cleanData({
      tournamentId,
      name,
      email,
      phone,
      dateOfBirth: body.dateOfBirth,
      age: body.age,
      gender: body.gender,
      tower: body.tower,
      flatNumber: body.flatNumber,
      emergencyContact: body.emergencyContact,
      expertiseLevel: body.expertiseLevel ?? 'intermediate',
      previousExperience: body.previousExperience,
      isResident: body.isResident,
      selectedCategory,
      profilePhotoUrl: body.profilePhotoUrl,
      partnerName: partnerName || undefined,
      partnerPhone: partnerPhone || undefined,
      partnerEmail: body.partnerEmail,
      partnerDateOfBirth: body.partnerDateOfBirth,
      partnerAge: body.partnerAge,
      partnerTower: body.partnerTower,
      partnerFlatNumber: body.partnerFlatNumber,
      partnerProfilePhotoUrl: body.partnerProfilePhotoUrl,
      partnerTshirtSize: body.partnerTshirtSize,
      tshirtSize: body.tshirtSize,
      isVolunteer: body.isVolunteer,
      teamPreference: body.teamPreference,
      paymentReference: body.paymentReference,
      selectedPaymentAccount: body.selectedPaymentAccount,
      paymentAmount,
      paymentMethod: body.paymentMethod ?? 'phone_number',
      registrationStatus: 'pending',
      paymentStatus: 'pending',
      registrationCode,
      registeredAt: FieldValue.serverTimestamp(),
    });

    const regRef = db.collection('tournaments').doc(tournamentId).collection('registrations').doc();
    await regRef.set(registrationData);

    await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('publicPlayers')
      .doc(regRef.id)
      .set(
        cleanData({
          tournamentId,
          name,
          partnerName: partnerName || undefined,
          profilePhotoUrl: body.profilePhotoUrl,
          partnerProfilePhotoUrl: body.partnerProfilePhotoUrl,
          selectedCategory,
          updatedAt: FieldValue.serverTimestamp(),
        })
      );

    const primaryId = `${regRef.id}-primary`;
    const hasPartner = !!partnerName;
    const partnerId = hasPartner ? `${regRef.id}-partner` : undefined;

    await db
      .collection('tournaments')
      .doc(tournamentId)
      .collection('players')
      .doc(primaryId)
      .set(
        cleanData({
          tournamentId,
          registrationId: regRef.id,
          name,
          email,
          phone,
          dateOfBirth: body.dateOfBirth,
          age: body.age,
          gender: body.gender,
          tower: body.tower,
          flatNumber: body.flatNumber,
          emergencyContact: body.emergencyContact,
          expertiseLevel: body.expertiseLevel ?? 'intermediate',
          previousExperience: body.previousExperience,
          isResident: body.isResident,
          selectedCategory,
          profilePhotoUrl: body.profilePhotoUrl,
          status: 'active',
          paymentStatus: 'pending',
          paymentReference: body.paymentReference,
          paymentAmount,
          paymentMethod: body.paymentMethod ?? 'phone_number',
          ...(partnerId ? { partnerId, partnerName } : {}),
          createdAt: FieldValue.serverTimestamp(),
        })
      );

    if (hasPartner && partnerId) {
      await db
        .collection('tournaments')
        .doc(tournamentId)
        .collection('players')
        .doc(partnerId)
        .set(
          cleanData({
            tournamentId,
            registrationId: regRef.id,
            name: partnerName,
            email: body.partnerEmail,
            phone: partnerPhone,
            dateOfBirth: body.partnerDateOfBirth,
            age: body.partnerAge ?? body.age,
            gender: body.gender,
            tower: body.partnerTower,
            flatNumber: body.partnerFlatNumber,
            emergencyContact: body.emergencyContact,
            expertiseLevel: body.expertiseLevel ?? 'intermediate',
            isResident: body.isResident,
            selectedCategory,
            profilePhotoUrl: body.partnerProfilePhotoUrl,
            status: 'active',
            partnerId: primaryId,
            partnerName: name,
            paymentStatus: 'pending',
            paymentReference: body.paymentReference,
            paymentAmount,
            paymentMethod: body.paymentMethod ?? 'phone_number',
            createdAt: FieldValue.serverTimestamp(),
          })
        );
    }

    return NextResponse.json({
      success: true,
      registrationId: regRef.id,
      registrationCode,
      priorRegistrations: existingCount,
    });
  } catch (error: unknown) {
    console.error('Error creating registration:', error);
    const message = error instanceof Error ? error.message : 'Failed to create registration';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
