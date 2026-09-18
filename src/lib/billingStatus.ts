// Pure reads over the server's BillingStatus — what to show, and whether to
// let the user in. Mirrors Web/src/components/billing/copy.ts so both clients
// describe an account the same way.
import type { BillingStatus } from '@/src/api/billing'

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.sukrit04.envelope'

/** Reminder thresholds, in days remaining. Matches payment-subscriptions-plan.md. */
export const REMINDER_DAYS = [7, 3, 1]

/**
 * Whether normal app features should be usable right now.
 *
 * Unknown (no status yet, or the request failed) is allowed: the server
 * enforces this on every route anyway, and failing closed would lock out a
 * paying user whose phone briefly lost signal.
 *
 * A cached answer cannot outlive an expiry it already knows about. A trial
 * that ended while the app sat offline is over — nothing can have renewed
 * it. A paid plan that will not auto-renew is the same. An auto-renewing one
 * is not: it most likely renewed, and only the server can say otherwise.
 */
export function accessAllowed(status: BillingStatus | undefined, now: number = Date.now()): boolean {
  if (!status) return true
  if (!status.allowed) return false
  if (!status.enforced) return true
  const knownEnd =
    status.mode === 'trial' ? status.trialEndsAt : status.mode === 'paid' && !status.autoRenew ? status.paidExpiresAt : null
  return !knownEnd || Date.parse(knownEnd) > now
}

/**
 * Whether billing is worth mentioning at all. Before launch both server
 * flags are off and nobody has paid, so the app keeps its pre-launch
 * "payments are coming" copy instead of a countdown to nothing.
 */
export function billingVisible(status: BillingStatus | undefined): boolean {
  return !!status && (status.enforced || status.purchaseEnabled || status.mode === 'paid')
}

/** The reminder threshold the trial is currently inside (7, 3 or 1), or null if it is not time to warn yet. */
export function trialReminderBucket(status: BillingStatus | undefined): number | null {
  if (!billingVisible(status) || status?.mode !== 'trial') return null
  const days = status.trialDaysRemaining
  return [...REMINDER_DAYS].reverse().find((d) => days <= d) ?? null
}

/** "3 days left", "Last day" — the phrase used everywhere the trial is mentioned. */
export function trialRemainingLabel(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'Last day'
  if (daysRemaining === 1) return '1 day left'
  return `${daysRemaining} days left`
}

/** One line for the More screen's Plan & billing row. */
export function planSummary(status: BillingStatus): string {
  switch (status.mode) {
    case 'trial':
      return `Free trial · ${trialRemainingLabel(status.trialDaysRemaining)}`
    case 'paid':
      if (status.renewalState === 'grace') return 'Payment issue · fix in Google Play'
      return status.autoRenew ? `Renews ${formatDate(status.paidExpiresAt)}` : `Ends ${formatDate(status.paidExpiresAt)}`
    case 'expired':
      return status.trialEndsAt && !status.productId ? 'Trial ended' : 'Subscription ended'
    default:
      return 'Finish setup to start your trial'
  }
}

/**
 * Why the account is locked, in the user's terms. Each case names something
 * the user can act on — "your payment did not go through" is useful, "status:
 * on_hold" is not.
 */
export function lockedReason(status: BillingStatus | undefined): string {
  switch (status?.renewalState) {
    case 'on_hold':
      return "Your subscription is on hold because a payment didn't go through. Updating your payment method in Google Play restores access."
    case 'paused':
      return 'Your subscription is paused. You can resume it from Google Play.'
    case 'revoked':
      return 'Your subscription was refunded, so it no longer provides access.'
    case 'pending':
      return 'Your payment is still being confirmed. This can take a little while with some payment methods. No need to pay again.'
    default:
      // Keyed on "never bought", not mode: a trial that ran out while the app
      // was offline is still reported as mode 'trial' by the cached status.
      return status?.trialEndsAt && !status.productId
        ? 'Your 45-day free trial has ended. Subscribe to carry on budgeting.'
        : 'Your subscription has ended. Subscribe to carry on budgeting.'
  }
}

/** Human date, e.g. "2 November 2026". Missing input renders as an em dash. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Whole-percent saving of yearly over twelve months of monthly, or null if there's no real saving to claim. */
export function yearlySavingsPercent(monthlyPrice: number, yearlyPrice: number): number | null {
  if (monthlyPrice <= 0) return null
  const pct = Math.floor((1 - yearlyPrice / (monthlyPrice * 12)) * 100)
  return pct > 0 ? pct : null
}
