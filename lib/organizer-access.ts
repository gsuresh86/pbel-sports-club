import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { buildTournamentAccessUpdate } from '@/lib/permissions';
import type { User, UserRole } from '@/types';

const KEEP_ROLE: UserRole[] = ['admin', 'super-admin', 'tournament-admin'];

/** Approve a self-serve tournament and grant its owner organizer access. */
export async function approveOrganizerTournament(tournamentId: string, reviewerId: string) {
  const tournamentRef = doc(db, 'tournaments', tournamentId);
  const tournamentSnap = await getDoc(tournamentRef);
  if (!tournamentSnap.exists()) throw new Error('Tournament not found');

  const ownerId = tournamentSnap.data().ownerId as string | undefined;
  if (!ownerId) throw new Error('This tournament has no organizer account to approve.');

  const userRef = doc(db, 'users', ownerId);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) throw new Error('Organizer account was not found.');

  const owner = { id: ownerId, ...userSnap.data() } as User;
  const access = buildTournamentAccessUpdate(
    owner.tournamentRoles,
    owner.tournamentPermissions,
    owner.assignedTournaments,
    tournamentId,
    ['tournament-admin'],
  );
  const role: UserRole = KEEP_ROLE.includes(owner.role) ? owner.role : 'tournament-admin';

  await updateDoc(userRef, {
    role,
    tournamentRoles: access.tournamentRoles,
    tournamentPermissions: access.tournamentPermissions,
    assignedTournaments: access.assignedTournaments,
    updatedAt: new Date(),
  });

  await updateDoc(tournamentRef, {
    approvalStatus: 'approved',
    approvedAt: new Date(),
    approvedBy: reviewerId,
    rejectionReason: null,
    updatedAt: new Date(),
  });
}

export async function rejectOrganizerTournament(
  tournamentId: string,
  reviewerId: string,
  reason: string,
) {
  await updateDoc(doc(db, 'tournaments', tournamentId), {
    approvalStatus: 'rejected',
    rejectionReason: reason.trim(),
    rejectedAt: new Date(),
    rejectedBy: reviewerId,
    updatedAt: new Date(),
  });
}
