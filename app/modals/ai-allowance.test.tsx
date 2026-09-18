import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import AiAllowanceScreen from './ai-allowance'

const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack }) }))

it('tells the user the allowance is spent, that nothing else is affected, and goes back on dismiss', () => {
  const { getByText } = renderWithProviders(<AiAllowanceScreen />)

  expect(getByText("You've used this month's AI")).toBeTruthy()
  expect(getByText('Everything else works as normal')).toBeTruthy()
  expect(getByText(/take a break until/)).toBeTruthy()

  fireEvent.press(getByText('Got it'))
  expect(mockBack).toHaveBeenCalled()
})
