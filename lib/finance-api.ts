import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { FinanceEntry, FinanceEntryType } from '@/types';

const toDate = (v: unknown) =>
  v != null && typeof (v as { toDate?: () => Date }).toDate === 'function'
    ? (v as { toDate: () => Date }).toDate()
    : undefined;

function toFinanceEntry(
  id: string,
  d: Record<string, unknown>,
  tournamentId: string
): FinanceEntry {
  return {
    id,
    tournamentId,
    type: (d.type as FinanceEntryType) ?? 'expense',
    category: (d.category as string) ?? 'other',
    description: (d.description as string) ?? '',
    amount: typeof d.amount === 'number' ? d.amount : Number(d.amount) || 0,
    date: toDate(d.date),
    note: (d.note as string) ?? undefined,
    createdBy: (d.createdBy as string) ?? undefined,
    createdAt: toDate(d.createdAt) ?? new Date(0),
    updatedAt: toDate(d.updatedAt),
  };
}

export interface FinanceEntryInput {
  type: FinanceEntryType;
  category: string;
  description: string;
  amount: number;
  date?: Date | null;
  note?: string | null;
}

export async function fetchTournamentFinances(
  tournamentId: string
): Promise<FinanceEntry[]> {
  const snap = await getDocs(
    query(
      collection(db, 'tournaments', tournamentId, 'finances'),
      orderBy('createdAt', 'desc')
    )
  );
  return snap.docs.map((d) => toFinanceEntry(d.id, d.data(), tournamentId));
}

export async function addFinanceEntry(
  tournamentId: string,
  input: FinanceEntryInput,
  createdBy?: string
): Promise<void> {
  const now = new Date();
  await addDoc(collection(db, 'tournaments', tournamentId, 'finances'), {
    type: input.type,
    category: input.category,
    description: input.description.trim(),
    amount: input.amount,
    date: input.date ?? null,
    note: input.note?.trim() || null,
    createdBy: createdBy ?? null,
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateFinanceEntry(
  tournamentId: string,
  entryId: string,
  input: FinanceEntryInput
): Promise<void> {
  await updateDoc(doc(db, 'tournaments', tournamentId, 'finances', entryId), {
    type: input.type,
    category: input.category,
    description: input.description.trim(),
    amount: input.amount,
    date: input.date ?? null,
    note: input.note?.trim() || null,
    updatedAt: new Date(),
  });
}

export async function deleteFinanceEntry(
  tournamentId: string,
  entryId: string
): Promise<void> {
  await deleteDoc(doc(db, 'tournaments', tournamentId, 'finances', entryId));
}
