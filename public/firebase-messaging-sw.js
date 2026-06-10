/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyDUbeJLXOoUmTMEktvYDvv4Piqs3vAWh2k',
  authDomain: 'blorbmart-b29b7.firebaseapp.com',
  projectId: 'blorbmart-b29b7',
  storageBucket: 'blorbmart-b29b7.firebasestorage.app',
  messagingSenderId: '840596799490',
  appId: '1:840596799490:web:963a63b358b1c282e6671b',
})

const messaging = firebase.messaging()

// Show a notification when a push arrives while the vendor portal tab is closed/backgrounded
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Blorbmart'
  const body = payload.notification?.body || ''

  self.registration.showNotification(title, {
    body,
    icon: '/orangelogo.png',
    badge: '/orangelogo.png',
    data: payload.data || {},
  })
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus()
      }
      if (self.clients.openWindow) return self.clients.openWindow('/')
    })
  )
})
