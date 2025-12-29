'use client';

import { messaging } from './firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import { db } from './firebase';
import { User } from '@/types';

// VAPID key - You should get this from Firebase Console > Project Settings > Cloud Messaging
// For now, using a placeholder - you'll need to replace this with your actual VAPID key
const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '';

/**
 * Request notification permission and get FCM token
 */
export async function requestNotificationPermission(): Promise<string | null> {
  if (!messaging) {
    console.warn('Firebase Messaging is not available');
    return null;
  }

  try {
    // Check if service worker is ready
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (!registration) {
        console.warn('Service Worker is not ready');
        return null;
      }
    }

    // Request permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      console.log('Notification permission granted');
      
      // Get FCM token
      // If VAPID_KEY is empty, Firebase will use the default key from Firebase Console
      const tokenOptions: { vapidKey?: string } = {};
      if (VAPID_KEY && VAPID_KEY.trim() !== '') {
        tokenOptions.vapidKey = VAPID_KEY;
      }
      
      const token = await getToken(messaging, tokenOptions);
      
      if (token) {
        console.log('FCM Token obtained:', token.substring(0, 20) + '...');
        return token;
      } else {
        console.warn('No FCM token available. Make sure you have configured Web Push certificates in Firebase Console.');
        return null;
      }
    } else {
      console.warn('Notification permission denied:', permission);
      return null;
    }
  } catch (error: any) {
    console.error('Error requesting notification permission:', error);
    return null;
  }
}

/**
 * Save FCM token to user document
 */
export async function saveFCMToken(userId: string, token: string): Promise<void> {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      fcmToken: token,
      fcmTokenUpdatedAt: new Date(),
    });
    console.log('FCM token saved for user:', userId);
  } catch (error) {
    console.error('Error saving FCM token:', error);
    throw error;
  }
}

/**
 * Initialize notifications for a user
 */
export async function initializeNotifications(user: User): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    // Check if service worker is supported
    if (!('serviceWorker' in navigator)) {
      console.warn('Service Workers are not supported in this browser');
      return;
    }

    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.warn('Notifications are not supported in this browser');
      return;
    }

    // Register service worker
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      console.log('Service Worker registered successfully:', registration.scope);
      
      // Wait for service worker to be ready
      await navigator.serviceWorker.ready;
      console.log('Service Worker is ready');
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return; // Don't proceed if service worker registration fails
    }

    // Request permission and get token
    const token = await requestNotificationPermission();
    
    if (token && user.id) {
      // Save token to user document
      await saveFCMToken(user.id, token);
      
      // Listen for foreground messages
      if (messaging) {
        onMessage(messaging, (payload) => {
          console.log('Message received in foreground:', payload);
          
          // Show notification if permission is granted
          if (Notification.permission === 'granted') {
            const notificationTitle = payload.notification?.title || 'Tournament Update';
            const notificationOptions = {
              body: payload.notification?.body || 'You have a new notification',
              icon: '/logo.png',
              badge: '/logo.png',
              tag: payload.data?.type || 'notification',
              data: payload.data,
            };
            
            new Notification(notificationTitle, notificationOptions);
          }
        });
      }
    }
  } catch (error) {
    console.error('Error initializing notifications:', error);
  }
}

/**
 * Check if notifications are supported
 */
export function isNotificationSupported(): boolean {
  if (typeof window === 'undefined') return false;
  return 'Notification' in window && 'serviceWorker' in navigator;
}

/**
 * Check if notification permission is granted
 */
export function hasNotificationPermission(): boolean {
  if (typeof window === 'undefined') return false;
  return Notification.permission === 'granted';
}

