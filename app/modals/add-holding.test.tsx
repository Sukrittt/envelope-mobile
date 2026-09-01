import { fireEvent, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { addHolding } from '@/src/api/holdings'
import AddHoldingModal from './add-holding'

jest.mock('@/src/api/holdings', () => ({ addHolding: jest.fn() }))

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
}))

beforeEach(() => {
  jest.clearAllMocks()
})

// "Add Holding" also appears as the screen's header title — the confirm
// button is the second match.
function pressSubmit(getAllByText: (t: string) => any[]) {
  fireEvent.press(getAllByText('Add Holding')[1])
}

it('submits a plain holding with the monthly toggle off', async () => {
  ;(addHolding as jest.Mock).mockResolvedValue(undefined)
  const { getByPlaceholderText, getAllByText } = renderWithProviders(<AddHoldingModal />)

  fireEvent.changeText(getByPlaceholderText('e.g. Stocks'), 'Stocks')
  fireEvent.changeText(getByPlaceholderText('0'), '1000')
  pressSubmit(getAllByText)

  await waitFor(() =>
    expect(addHolding).toHaveBeenCalledWith({
      name: 'Stocks',
      type: 'Other',
      value: '1000',
      is_recurring: false,
      recurring_amount: undefined,
    }),
  )
})

it('submits the value as the monthly amount once "Repeat monthly" is on', async () => {
  const { getByPlaceholderText, getAllByText, getByRole } = renderWithProviders(<AddHoldingModal />)

  fireEvent.changeText(getByPlaceholderText('e.g. Stocks'), 'Mutual Fund SIP')
  fireEvent.changeText(getByPlaceholderText('0'), '5000')
  fireEvent(getByRole('switch'), 'valueChange', true)

  pressSubmit(getAllByText)

  await waitFor(() =>
    expect(addHolding).toHaveBeenCalledWith({
      name: 'Mutual Fund SIP',
      type: 'Other',
      value: '5000',
      is_recurring: true,
      recurring_amount: '5000',
    }),
  )
})
