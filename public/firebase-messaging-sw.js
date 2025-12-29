// Firebase Cloud Messaging Service Worker
// Import Firebase scripts (using compat version for service workers)
// Note: Using v9 compat as it's more stable for service workers
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAltEbTTfGs5CsMftHJVeehC0J5_KXCNDE",
  authDomain: "s3y-studio.firebaseapp.com",
  projectId: "s3y-studio",
  storageBucket: "s3y-studio.firebasestorage.app",
  messagingSenderId: "225427241333",
  appId: "1:225427241333:web:6f9cfd4e417ef2b0f43b3c"
};

// Initialize Firebase (compat mode)
firebase.initializeApp(firebaseConfig);

// Retrieve an instance of Firebase Messaging so that it can handle background messages
const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('Received background message:', payload);
  
  const notificationTitle = payload.notification?.title || 'Tournament Update';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/logo.png',
    badge: '/logo.png',
    tag: payload.data?.type || 'notification',
    data: payload.data,
    requireInteraction: true,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const data = event.notification.data;
  let url = '/';
  
  if (data?.tournamentId) {
    url = `/tournament/${data.tournamentId}`;
  } else if (data?.type === 'tournament') {
    url = '/admin/tournaments';
  } else if (data?.type === 'registration') {
    url = `/admin/tournaments/${data.tournamentId}`;
  }
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window/tab open with the target URL
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      // If not, open a new window/tab
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

