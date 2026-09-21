import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import AiAllowanceScreen from './ai-allowance'

const mockBack = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ back: mockBack, canGoBack: () => true }) }))

it('tells the user the allowance is spent, that nothing else is affected, and goes back on dismiss', () => {
  const { getByText } = renderWithProviders(<AiAllowanceScreen />)

  expect(getByText('AI allowance reached')).toBeTruthy()
  expect(getByText(/Everything else works as normal/)).toBeTruthy()
  expect(getByText(/bill scanning are back on/)).toBeTruthy()

  fireEvent.press(getByText('Go back'))
  expect(mockBack).toHaveBeenCalled()
})
