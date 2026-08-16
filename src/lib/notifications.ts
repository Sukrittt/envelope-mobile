import { Platform } from 'react-native'
import * as Device from 'expo-device'
import * as Notifications from 'expo-notifications'
import Constants from 'expo-constants'
import { router } from 'expo-router'
import { registerPushToken } from '@/src/api/notifications'

/** Show alert + sound for notifications received while the app is foregrounded. */
export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  })
}

async function registerToken(token: string): Promise<void> {
  await registerPushToken(token, Platform.OS === 'android' ? 'android' : 'ios')
}

/**
 * Request permission and register this device's Expo push token with the
 * backend. Bails out cleanly (no throw) on simulators, permission denial, or
 * any error — a push registration failure must never block app usage.
 */
export async function registerForPushNotificationsAsync(): Promise<void> {
  try {
    if (!Device.isDevice) return

    let { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      ;({ status } = await Notifications.requestPermissionsAsync())
    }
    if (status !== 'granted') return

    // TODO: run `eas init` (once logged into an EAS account) and fill in
    // Mobile/app.json's extra.eas.projectId — until then push tokens can't
    // be minted and this call throws, which the catch below swallows.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId })
    await registerToken(token)
  } catch (err) {
    console.warn('Push registration failed', err)
  }
}

/**
 * Re-register whenever Expo rotates the push token (rare, but happens).
 * Returns the subscription so callers can `.remove()` it on unmount.
 */
export function addPushTokenListener(): Notifications.Subscription {
  return Notifications.addPushTokenListener((token) => {
    registerToken(token.data).catch((err) => console.warn('Push token re-registration failed', err))
  })
}

/**
 * Deep-link into the Activity tab for a given day when the user taps a
 * notification, reusing the existing `?date=` param the tab already reads.
 */
export function addNotificationResponseListener(): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener((response) => {
    const date = response.notification.request.content.data?.date
    if (typeof date === 'string' && date) {
      router.push(`/(tabs)/activity?date=${date}`)
    }
  })
}
