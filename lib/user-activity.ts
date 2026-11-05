import { addDoc, collection } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export type UserActivityType =
  | 'login'
  | 'tournament_created'
  | 'user_created'
  | 'match_scored';

export interface UserActivityEvent {
  id?: string;
  userId: string;
  userName?: string;
  userEmail?: string;
  type: UserActivityType;
  title: string;
  detail?: string;
  tournamentId?: string;
  tournamentName?: string;
  createdAt: Date;
  source?: 'live' | 'derived';
}

export async function logUserActivity(
  event: Omit<UserActivityEvent, 'id' | 'createdAt' | 'source'>
) {
  await addDoc(collection(db, 'userActivity'), {
    ...event,
    createdAt: new Date(),
    source: 'live',
  });
}
