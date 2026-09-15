import { Animated } from 'react-native'
import { act, fireEvent } from '@testing-library/react-native'
import { Path } from 'react-native-svg'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { currentMonthKey } from '@/src/lib/envelope'
import HomeScreen from './index'

const MONTH = currentMonthKey()

let mockBudgets: { month: string; category: string; assigned: string; rolled_over: string }[] = []

jest.mock('@/src/hooks/useBudgets', () => ({
  useBudgets: () => ({ data: mockBudgets, isLoading: false, error: null }),
}))
jest.mock('@/src/hooks/useExpenses', () => ({ useExpenses: () => ({ data: [], isLoading: false, error: null }) }))
jest.mock('@/src/hooks/useCategories', () => ({
  useCategories: () => ({ data: [{ name: 'Food', group: 'Everyday' }], isLoading: false, error: null }),
}))
jest.mock('@/src/hooks/useGroups', () => ({ useGroups: () => ({ data: ['Everyday'], isLoading: false, error: null }) }))
const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
  useIsFocused: () => true,
}))

function renderHome() {
  return renderWithProviders(<HomeScreen />)
}

describe('HomeScreen · Ready to Assign', () => {
  beforeEach(() => {
    mockPush.mockClear()
    mockBudgets = [
      { month: MONTH, category: '__income__', assigned: '20000', rolled_over: '0' },
      { month: MONTH, category: 'Food', assigned: '5000', rolled_over: '0' },
    ]
  })

  it('shows Ready to Assign as income minus assigned', () => {
    const { getByLabelText } = renderHome()
    // Ready to Assign = 20,000 income - 5,000 assigned to Food.
    expect(getByLabelText('₹15,000')).toBeTruthy()
  })

  it('uses the app icon as the home header brand', () => {
    const { getByLabelText, queryByText, UNSAFE_getAllByType } = renderHome()

    expect(getByLabelText('Aviary app icon')).toBeTruthy()
    expect(queryByText('Aviary')).toBeNull()
    expect(UNSAFE_getAllByType(Path).some((path) => path.props.fill === '#000000')).toBe(true)
  })

  it('fades the settled bird out before resetting the landing choreography', async () => {
    const timingSpy = jest.spyOn(Animated, 'timing')
    const landingSpy = jest.spyOn(Animated, 'parallel')
    const { getByLabelText } = renderHome()
    await act(async () => {})
    timingSpy.mockClear()
    landingSpy.mockClear()

    fireEvent.press(getByLabelText('Aviary app icon'))

    expect(timingSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ toValue: 0, duration: 180 }),
    )
    expect(landingSpy).not.toHaveBeenCalled()
    timingSpy.mockRestore()
    landingSpy.mockRestore()
  })

  it('opens the full-screen edit-assigned-amount modal for the tapped category', () => {
    const { getByText } = renderHome()

    fireEvent.press(getByText('Food'))
    fireEvent.press(getByText('Edit assigned amount'))

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/modals/edit-assigned-amount',
      params: { category: 'Food' },
    })
  })
})
