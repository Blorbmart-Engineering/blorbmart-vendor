import { getToken } from 'firebase/messaging'
import { getMessagingIfSupported } from '../lib/firebase'
import { apiUrl } from '../lib/api'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined
const REGISTERED_KEY = 'blorbmart-vendor-push-token'

// Requests notification permission, grabs an FCM token, and registers it
// with the backend so this vendor receives web push for new orders.
export const registerVendorPushNotifications = async (uid: string): Promise<void> => {
  if (!VAPID_KEY) {
    console.warn('VITE_FIREBASE_VAPID_KEY is not set — skipping web push registration')
    return
  }

  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return
  }

  try {
    const messaging = await getMessagingIfSupported()
    if (!messaging) return

    let permission = Notification.permission
    if (permission === 'default') {
      permission = await Notification.requestPermission()
    }
    if (permission !== 'granted') return

    const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })
    if (!token) return

    if (sessionStorage.getItem(REGISTERED_KEY) === token) return

    const response = await fetch(apiUrl('/api/notifications/tokens/register'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, token, platform: 'web' }),
    })

    if (response.ok) {
      sessionStorage.setItem(REGISTERED_KEY, token)
    }
  } catch (error) {
    console.error('Failed to register vendor push notifications:', error)
  }
}
