import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import type { BillingStatus } from '@/src/api/billing'
import PlanScreen from './plan'

const mockPush = jest.fn()
let mockCanGoBack = true
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), canGoBack: () => mockCanGoBack }),
}))

let mockStatus: BillingStatus | undefined
jest.mock('@/src/hooks/useBillingStatus', () => ({
  useBillingStatus: () => ({ data: mockStatus, isLoading: false }),
  seedBillingStatus: jest.fn(),
}))

const base: BillingStatus = {
  mode: 'trial',
  allowed: true,
  enforced: true,
  trialStartedAt: '2026-09-01T00:00:00Z',
  trialEndsAt: '2099-10-16T00:00:00Z',
  trialDaysRemaining: 12,
  productId: null,
  basePlanId: null,
  paidExpiresAt: null,
  autoRenew: false,
  renewalState: null,
  retentionDeadline: null,
  purchaseEnabled: true,
}

beforeEach(() => {
  jest.clearAllMocks()
  mockCanGoBack = true
})

it('shows the trial countdown without the lock-screen exits', () => {
  mockStatus = base
  const { getByText, queryByText } = renderWithProviders(<PlanScreen />)

  expect(getByText('Free trial · 12 days left')).toBeTruthy()
  expect(queryByText(/Export it free/)).toBeNull()
})

it('gives an expired account every exit the plan promises', () => {
  mockCanGoBack = false
  mockStatus = { ...base, mode: 'expired', allowed: false, trialDaysRemaining: 0 }
  const { getByText } = renderWithProviders(<PlanScreen />)

  expect(getByText('Your free trial has ended')).toBeTruthy()
  expect(getByText('Restore purchases')).toBeTruthy()
  expect(getByText('Sign out')).toBeTruthy()

  fireEvent.press(getByText(/Export it free/))
  expect(mockPush).toHaveBeenCalledWith('/account/data')
  fireEvent.press(getByText('Manage or delete account'))
  expect(mockPush).toHaveBeenCalledWith('/account/security')
})
