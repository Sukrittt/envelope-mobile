import type { BillingStatus } from '@/src/api/billing'
import { accessAllowed, billingVisible, lockedReason, planSummary, trialReminderBucket, yearlySavingsPercent } from './billingStatus'

const NOW = Date.parse('2026-10-01T00:00:00Z')
const DAY = 86_400_000

function status(over: Partial<BillingStatus> = {}): BillingStatus {
  return {
    mode: 'trial',
    allowed: true,
    enforced: true,
    trialStartedAt: new Date(NOW - 40 * DAY).toISOString(),
    trialEndsAt: new Date(NOW + 5 * DAY).toISOString(),
    trialDaysRemaining: 5,
    productId: null,
    basePlanId: null,
    paidExpiresAt: null,
    autoRenew: false,
    renewalState: null,
    retentionDeadline: null,
    purchaseEnabled: true,
    ...over,
  }
}

describe('accessAllowed', () => {
  it('fails open while the status is unknown', () => {
    expect(accessAllowed(undefined, NOW)).toBe(true)
  })

  it('follows the server when it says no', () => {
    expect(accessAllowed(status({ mode: 'expired', allowed: false }), NOW)).toBe(false)
  })

  it('locks a cached trial once its known end has passed', () => {
    const s = status({ trialEndsAt: new Date(NOW - 1).toISOString() })
    expect(accessAllowed(s, NOW)).toBe(false)
  })

  it('never locks while enforcement is off, whatever the dates say', () => {
    const s = status({ enforced: false, trialEndsAt: new Date(NOW - DAY).toISOString() })
    expect(accessAllowed(s, NOW)).toBe(true)
  })

  it('trusts an auto-renewing plan past its cached expiry', () => {
    const s = status({ mode: 'paid', autoRenew: true, paidExpiresAt: new Date(NOW - DAY).toISOString() })
    expect(accessAllowed(s, NOW)).toBe(true)
  })

  it('locks a cancelled plan past its cached expiry', () => {
    const s = status({ mode: 'paid', autoRenew: false, paidExpiresAt: new Date(NOW - DAY).toISOString() })
    expect(accessAllowed(s, NOW)).toBe(false)
  })
})

describe('billingVisible', () => {
  it('stays hidden before launch, when both flags are off and nobody paid', () => {
    expect(billingVisible(status({ enforced: false, purchaseEnabled: false }))).toBe(false)
  })

  it('shows once either flag is on, or the account has paid', () => {
    expect(billingVisible(status({ enforced: false, purchaseEnabled: true }))).toBe(true)
    expect(billingVisible(status({ enforced: false, purchaseEnabled: false, mode: 'paid' }))).toBe(true)
  })
})

describe('trialReminderBucket', () => {
  it.each([
    [8, null],
    [7, 7],
    [4, 7],
    [3, 3],
    [2, 3],
    [1, 1],
    [0, 1],
  ])('%i days left -> %p', (days, bucket) => {
    expect(trialReminderBucket(status({ trialDaysRemaining: days }))).toBe(bucket)
  })

  it('is silent before launch and outside a trial', () => {
    expect(trialReminderBucket(status({ enforced: false, purchaseEnabled: false }))).toBeNull()
    expect(trialReminderBucket(status({ mode: 'paid', trialDaysRemaining: 0 }))).toBeNull()
  })
})

describe('copy', () => {
  it('names the trial in the plan summary', () => {
    expect(planSummary(status({ trialDaysRemaining: 3 }))).toBe('Free trial · 3 days left')
  })

  it('explains a lapsed trial as a trial, even from a stale cached status', () => {
    expect(lockedReason(status({ mode: 'trial' }))).toMatch(/free trial has ended/)
    expect(lockedReason(status({ mode: 'expired', productId: 'envelope_individual' }))).toMatch(/subscription has ended/)
    expect(lockedReason(status({ renewalState: 'on_hold' }))).toMatch(/on hold/)
  })
})

describe('yearlySavingsPercent', () => {
  it('rounds the saving down so the badge never overstates it', () => {
    expect(yearlySavingsPercent(39, 399)).toBe(14)
    expect(yearlySavingsPercent(9.99, 79.99)).toBe(33)
  })

  it('claims nothing when yearly is not cheaper', () => {
    expect(yearlySavingsPercent(39, 468)).toBeNull()
    expect(yearlySavingsPercent(0, 399)).toBeNull()
  })
})
