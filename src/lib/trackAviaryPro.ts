// Puts the user's own Aviary subscription into the app's subscriptions
// tracker after they buy it, so it budgets like any other recurring charge.
import type { PurchasesPackage } from 'react-native-purchases'
import { addSubscription, getSubscriptions, updateSubscription } from '@/src/api/subscriptions'
import { getCategories } from '@/src/api/categories'
import type { CategoryRow, SubscriptionRow } from '@/src/types'

export const AVIARY_PRO_SERVICE = 'Aviary Pro'

/**
 * The envelope to charge Aviary Pro to: whichever one the user already files
 * most of their subscriptions under, else one that looks like a subscriptions
 * envelope, else none (the user can link it later).
 */
export function pickSubscriptionCategory(subs: SubscriptionRow[], categories: CategoryRow[]): string {
  const live = new Set(categories.map((c) => c.name))
  const counts = new Map<string, number>()
  for (const s of subs) {
    if (s.category && live.has(s.category)) counts.set(s.category, (counts.get(s.category) ?? 0) + 1)
  }
  const mostUsed = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0]
  if (mostUsed) return mostUsed
  return categories.find((c) => /subscri|stream|software|\bapps?\b|digital|ott/i.test(c.name))?.name ?? ''
}

/** YYYY-MM-DD in IST, the tracker's date format. */
function istDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

/**
 * Add Aviary Pro to the tracker, or bring an existing entry up to date (a
 * monthly to yearly switch, a resubscribe). Best effort: the purchase has
 * already succeeded, so a failure here must never surface as a purchase error.
 */
export async function trackAviaryPro(pkg: PurchasesPackage, nextDueIso: string | null): Promise<void> {
  try {
    const fields = {
      amount_inr: String(pkg.product.price),
      billing_cycle: /annual/i.test(pkg.packageType) ? 'yearly' : 'monthly',
      next_due_date: nextDueIso ? istDate(nextDueIso) : '',
    }
    const [subs, categories] = await Promise.all([getSubscriptions(), getCategories()])
    const existing = subs.find((s) => s.service.toLowerCase() === AVIARY_PRO_SERVICE.toLowerCase())
    if (existing) {
      await updateSubscription(existing.service, { ...fields, status: 'active' })
    } else {
      await addSubscription({ service: AVIARY_PRO_SERVICE, ...fields, category: pickSubscriptionCategory(subs, categories) })
    }
  } catch (err) {
    console.warn('[billing] could not add Aviary Pro to subscriptions:', (err as Error).message)
  }
}
