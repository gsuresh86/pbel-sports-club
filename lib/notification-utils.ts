'use client';

import { collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { db } from './firebase';
import { User, Notification } from '@/types';

/**
 * Get FCM tokens for all admin users
 */
export async function getAdminFCMTokens(): Promise<string[]> {
  try {
    const usersQuery = query(
      collection(db, 'users'),
      where('role', 'in', ['admin', 'super-admin']),
      where('isActive', '==', true)
    );
    
    const snapshot = await getDocs(usersQuery);
    const tokens: string[] = [];
    
    snapshot.forEach((doc) => {
      const userData = doc.data();
      const fcmToken = userData.fcmToken as string | undefined;
      if (fcmToken) {
        tokens.push(fcmToken);
      }
    });
    
    return tokens;
  } catch (error) {
    console.error('Error getting admin FCM tokens:', error);
    return [];
  }
}

/**
 * Get FCM token for tournament admin
 */
export async function getTournamentAdminFCMToken(tournamentId: string): Promise<string[]> {
  try {
    // Get tournament to find createdBy
    const { doc, getDoc } = await import('firebase/firestore');
    const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
    
    if (!tournamentDoc.exists()) {
      return [];
    }
    
    const tournamentData = tournamentDoc.data();
    const createdBy = tournamentData.createdBy;
    
    if (!createdBy) {
      return [];
    }
    
    // Get user document
    const userDoc = await getDoc(doc(db, 'users', createdBy));
    
    if (!userDoc.exists()) {
      return [];
    }
    
    const userData = userDoc.data();
    const tokens: string[] = [];
    
    const fcmToken = userData.fcmToken as string | undefined;
    if (fcmToken) {
      tokens.push(fcmToken);
    }
    
    // Also check if there are assigned tournament admins
    const assignedTournaments = userData.assignedTournaments as string[] | undefined;
    if (assignedTournaments?.includes(tournamentId)) {
      // Get all users assigned to this tournament
      const usersQuery = query(
        collection(db, 'users'),
        where('assignedTournaments', 'array-contains', tournamentId),
        where('isActive', '==', true)
      );
      
      const assignedSnapshot = await getDocs(usersQuery);
      assignedSnapshot.forEach((assignedDoc) => {
        const assignedUserData = assignedDoc.data();
        const assignedFcmToken = assignedUserData.fcmToken as string | undefined;
        if (assignedFcmToken && !tokens.includes(assignedFcmToken)) {
          tokens.push(assignedFcmToken);
        }
      });
    }
    
    return tokens;
  } catch (error) {
    console.error('Error getting tournament admin FCM token:', error);
    return [];
  }
}

/**
 * Send notification via API
 */
export async function sendNotification(
  tokens: string[],
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  if (tokens.length === 0) {
    console.log('No tokens to send notification to');
    return;
  }
  
  try {
    const response = await fetch('/api/send-notification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tokens,
        notification: {
          title,
          body,
        },
        data,
      }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to send notification');
    }
    
    const result = await response.json();
    console.log('Notification sent:', result);
  } catch (error) {
    console.error('Error sending notification:', error);
    // Don't throw - notifications are non-critical
  }
}

/**
 * Save notification to Firestore
 */
async function saveNotificationToFirestore(
  userId: string,
  title: string,
  body: string,
  type: Notification['type'],
  data?: Notification['data']
): Promise<void> {
  try {
    await addDoc(collection(db, 'notifications'), {
      userId,
      title,
      body,
      type,
      data: data || {},
      read: false,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error('Error saving notification to Firestore:', error);
  }
}

/**
 * Notify admins about new tournament
 */
export async function notifyAdminsNewTournament(tournamentName: string, tournamentId: string): Promise<void> {
  // Get admin users
  const usersQuery = query(
    collection(db, 'users'),
    where('role', 'in', ['admin', 'super-admin']),
    where('isActive', '==', true)
  );
  
  const snapshot = await getDocs(usersQuery);
  const adminUsers: User[] = [];
  const tokens: string[] = [];
  
  snapshot.forEach((doc) => {
    const userData = doc.data();
    const fcmToken = userData.fcmToken as string | undefined;
    if (fcmToken) {
      tokens.push(fcmToken);
    }
    adminUsers.push({
      id: doc.id,
      ...userData,
      createdAt: userData.createdAt?.toDate() || new Date(),
    } as User);
  });
  
  // Send push notifications
  if (tokens.length > 0) {
    await sendNotification(
      tokens,
      'New Tournament Created',
      `A new tournament "${tournamentName}" has been created and needs review.`,
      {
        type: 'tournament',
        tournamentId,
        action: 'view',
      }
    );
  }
  
  // Save notifications to Firestore for each admin
  const notificationPromises = adminUsers.map((user) =>
    saveNotificationToFirestore(
      user.id,
      'New Tournament Created',
      `A new tournament "${tournamentName}" has been created and needs review.`,
      'tournament',
      { tournamentId }
    )
  );
  
  await Promise.all(notificationPromises);
}

/**
 * Notify tournament admin about new registration
 */
export async function notifyTournamentAdminNewRegistration(
  tournamentId: string,
  tournamentName: string,
  playerName: string
): Promise<void> {
  // Get tournament admin user IDs
  const { doc, getDoc } = await import('firebase/firestore');
  const tournamentDoc = await getDoc(doc(db, 'tournaments', tournamentId));
  
  if (!tournamentDoc.exists()) {
    return;
  }
  
  const tournamentData = tournamentDoc.data();
  const createdBy = tournamentData.createdBy;
  const adminUserIds: string[] = [];
  
  if (createdBy) {
    adminUserIds.push(createdBy);
  }
  
  // Get users assigned to this tournament
  const usersQuery = query(
    collection(db, 'users'),
    where('assignedTournaments', 'array-contains', tournamentId),
    where('isActive', '==', true)
  );
  
  const assignedSnapshot = await getDocs(usersQuery);
  assignedSnapshot.forEach((assignedDoc) => {
    if (!adminUserIds.includes(assignedDoc.id)) {
      adminUserIds.push(assignedDoc.id);
    }
  });
  
  // Get FCM tokens for these users
  const tokens: string[] = [];
  const userDocs = await Promise.all(
    adminUserIds.map((userId) => getDoc(doc(db, 'users', userId)))
  );
  
  userDocs.forEach((userDoc) => {
    if (userDoc.exists()) {
      const userData = userDoc.data();
      const fcmToken = userData.fcmToken as string | undefined;
      if (fcmToken) {
        tokens.push(fcmToken);
      }
    }
  });
  
  // Send push notifications
  if (tokens.length > 0) {
    await sendNotification(
      tokens,
      'New Player Registration',
      `${playerName} has registered for "${tournamentName}"`,
      {
        type: 'registration',
        tournamentId,
        action: 'view',
      }
    );
  }
  
  // Save notifications to Firestore for each admin
  const notificationPromises = adminUserIds.map((userId) =>
    saveNotificationToFirestore(
      userId,
      'New Player Registration',
      `${playerName} has registered for "${tournamentName}"`,
      'registration',
      { tournamentId }
    )
  );
  
  await Promise.all(notificationPromises);
}

