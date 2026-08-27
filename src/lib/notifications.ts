import { Platform } from 'react-native'
import * as Device from 'expo-device'
import Constants, { ExecutionEnvironment } from 'expo-constants'
import { router } from 'expo-router'
import { registerPushToken } from '@/src/api/notifications'
import type * as NotificationsType from 'expo-notifications'

// expo-notifications throws on Android *just from being imported* inside Expo Go
// (remote notifications were removed from Expo Go as of SDK 53) — a static `import`
// at the top of this file would crash the app before any guard could run. So the
// module is required lazily, only once we know we're not running under Expo Go.
const PUSH_SUPPORTED = Constants.executionEnvironment !== ExecutionEnvironment.StoreClient

function getNotifications(): typeof NotificationsType | null {
  if (!PUSH_SUPPORTED) return null
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-notifications') as typeof NotificationsType
}

/** Show alert + sound for notifications received while the app is foregrounded. */
export function configureNotificationHandler(): void {
  const Notifications = getNotifications()
  if (!Notifications) return
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
    const Notifications = getNotifications()
    if (!Notifications || !Device.isDevice) return

    let { status } = await Notifications.getPermissionsAsync()
    if (status !== 'granted') {
      ;({ status } = await Notifications.requestPermissionsAsync())
    }
    if (status !== 'granted') return

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
export function addPushTokenListener(): NotificationsType.Subscription | undefined {
  const Notifications = getNotifications()
  if (!Notifications) return undefined
  return Notifications.addPushTokenListener((token) => {
    registerToken(token.data).catch((err) => console.warn('Push token re-registration failed', err))
  })
}

/**
 * Deep-link into the Activity tab for a given day, reusing the existing
 * `?date=` param the tab already reads. Shared by the warm-tap listener
 * below and `checkColdStartNotification` — a tap that launches the app from
 * killed goes through `getLastNotificationResponseAsync` instead of the
 * listener, but should land in the same place.
 */
function routeFromNotificationResponse(response: NotificationsType.NotificationResponse): void {
  const date = response.notification.request.content.data?.date
  if (typeof date === 'string' && date) {
    router.push(`/(tabs)/activity?date=${date}`)
  }
}

/** Deep-link when the user taps a notification while the app is running (foreground or backgrounded). */
export function addNotificationResponseListener(): NotificationsType.Subscription | undefined {
  const Notifications = getNotifications()
  if (!Notifications) return undefined
  return Notifications.addNotificationResponseReceivedListener(routeFromNotificationResponse)
}

/**
 * Deep-link when a notification tap *launched* the app from killed —
 * `addNotificationResponseListener` only fires for a tap while the app is
 * already running, so a cold start otherwise drops the tap silently. Call
 * once on startup, after the router is mounted.
 */
export async function checkColdStartNotification(): Promise<void> {
  const Notifications = getNotifications()
  if (!Notifications) return
  const response = await Notifications.getLastNotificationResponseAsync()
  if (!response) return
  routeFromNotificationResponse(response)
  await Notifications.clearLastNotificationResponseAsync()
}
