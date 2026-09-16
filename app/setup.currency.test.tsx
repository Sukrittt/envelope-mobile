import { fireEvent, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import SetupScreen from './setup'
import { onOnboarded } from '@/src/api/onboardingSignal'
import { updateUser } from '@/src/api/account'

jest.mock('@/src/api/account', () => ({ updateUser: jest.fn(async patch => patch) }))
jest.mock('@/src/api/budgets', () => ({ updateBudget: jest.fn(async () => ({})) }))
jest.mock('@/src/api/groups', () => ({ addGroup: jest.fn(async () => ({})) }))
jest.mock('@/src/api/categories', () => ({ addCategory: jest.fn(async () => ({})) }))
jest.mock('@/src/api/accessMode', () => ({ accessMode: { subscribeLogout: () => () => {} } }))
jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn(async () => null), setItemAsync: jest.fn(async () => {}), deleteItemAsync: jest.fn(async () => {}) }))

it('selects currency before income, preserves it on back, and saves it with onboarding', async () => {
  const onFinished = jest.fn()
  const unsubscribe = onOnboarded(onFinished)
  const { getByText, getByLabelText, unmount } = renderWithProviders(<SetupScreen />)
  expect(getByText('Choose your currency')).toBeTruthy()
  fireEvent.changeText(getByLabelText('Search currencies'), 'USD')
  fireEvent.press(getByLabelText('US Dollar, USD, $'))
  fireEvent.press(getByText('Continue'))
  expect(getByText('What lands each month?')).toBeTruthy()
  fireEvent.press(getByLabelText('Go back'))
  expect(getByLabelText('Selected currency, US Dollar, USD')).toBeTruthy()
  fireEvent.press(getByText('Continue'))
  fireEvent.press(getByText('$50,000'))
  fireEvent.press(getByText('Continue'))
  fireEvent.press(getByText('Continue'))
  fireEvent.press(getByText('Continue'))
  fireEvent.press(getByText('Finish setup'))
  await waitFor(() => expect(updateUser).toHaveBeenCalledWith(expect.objectContaining({ currencyCode: 'USD', onboardedAt: expect.any(String) })))
  await waitFor(() => expect(getByText('Show me how it works')).toBeTruthy())
  expect(onFinished).not.toHaveBeenCalled()
  fireEvent.press(getByText('Show me how it works'))
  expect(onFinished).toHaveBeenCalledTimes(1)
  unsubscribe()
  unmount()
})
