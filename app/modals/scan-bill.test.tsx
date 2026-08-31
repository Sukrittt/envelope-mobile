import { act, fireEvent, waitFor } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { getCategories } from '@/src/api/categories'
import { addExpense, getExpenses } from '@/src/api/expenses'
import { scanBill } from '@/src/api/scan'
import ScanBillScreen from './scan-bill'

jest.mock('@/src/api/categories', () => ({
  getCategories: jest.fn(),
  addCategory: jest.fn(),
  updateCategory: jest.fn(),
  deleteCategory: jest.fn(),
  moveCategory: jest.fn(),
}))
jest.mock('@/src/api/expenses', () => ({
  getExpenses: jest.fn(),
  addExpense: jest.fn(),
  updateExpense: jest.fn(),
  deleteExpense: jest.fn(),
}))
jest.mock('@/src/api/scan', () => ({ scanBill: jest.fn() }))

const mockBack = jest.fn()
const mockReplace = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: mockReplace, push: jest.fn(), navigate: jest.fn() }),
}))

const mockRequestCamera = jest.fn()
const mockRequestLibrary = jest.fn()
const mockLaunchCamera = jest.fn()
const mockLaunchLibrary = jest.fn()
jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: () => mockRequestCamera(),
  requestMediaLibraryPermissionsAsync: () => mockRequestLibrary(),
  launchCameraAsync: (opts: unknown) => mockLaunchCamera(opts),
  launchImageLibraryAsync: (opts: unknown) => mockLaunchLibrary(opts),
}))

const CATEGORIES = [{ name: 'Groceries', group: 'Essentials' }]

// total (900) exceeds the item sum (860) by 40 — a delivery fee reconcile
// should surface as its own "Fees & taxes" row rather than silently vanishing.
const SCAN_RESULT = {
  merchant: 'Blinkit',
  total: 900,
  date: '2026-08-29',
  category: 'Groceries',
  items: [
    { name: 'Milk', price: 60, qty: 1 },
    { name: 'Pizza', price: 800, qty: 1 },
  ],
}

/** Flushes past react-query's internal promise chain (fetch -> setData -> notify -> re-render) so a resolved query (categories) lands in state before the next assertion — a single micro/macrotask hop isn't reliably deep enough. */
async function flushCategories() {
  for (let i = 0; i < 10; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getCategories as jest.Mock).mockResolvedValue(CATEGORIES)
  ;(getExpenses as jest.Mock).mockResolvedValue([])
  mockRequestLibrary.mockResolvedValue({ granted: true })
  mockRequestCamera.mockResolvedValue({ granted: true })
})

describe('ScanBillScreen', () => {
  it('goes back when the picker is cancelled', async () => {
    mockLaunchLibrary.mockResolvedValue({ canceled: true, assets: null })
    const { getByText } = renderWithProviders(<ScanBillScreen />)

    fireEvent.press(getByText('Choose a screenshot'))
    await waitFor(() => expect(mockBack).toHaveBeenCalled())
  })

  it('scans, reviews, and confirms at the computed split share', async () => {
    mockLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://cart.png', base64: 'abc123', mimeType: 'image/png', width: 100, height: 100 }],
    })
    ;(scanBill as jest.Mock).mockResolvedValue(SCAN_RESULT)
    ;(addExpense as jest.Mock).mockResolvedValue({ id: 'e1', timestamp: '2026-08-29T10:00:00' })

    const { getByText, getByDisplayValue } = renderWithProviders(<ScanBillScreen />)

    // Categories load asynchronously — flush that before picking, or the
    // screen would (correctly) refuse to scan with an empty category list.
    await flushCategories()
    fireEvent.press(getByText('Choose a screenshot'))

    await waitFor(() => expect(scanBill).toHaveBeenCalled())
    // react-query invokes the mutationFn with a second (client/meta) argument —
    // only the first is ours to assert on.
    expect((scanBill as jest.Mock).mock.calls[0][0]).toEqual({
      image: 'abc123',
      mimeType: 'image/png',
      categories: ['Groceries'],
    })

    // Everything lands "mine" by default, including the reconciled fees row,
    // so my share is the full printed total: 60 + 800 + 40 = 900.
    await waitFor(() => expect(getByText('₹900')).toBeTruthy())
    expect(getByDisplayValue('Blinkit')).toBeTruthy()

    fireEvent.press(getByText('Confirm'))

    await waitFor(() =>
      expect(addExpense).toHaveBeenCalledWith({
        item: 'Blinkit',
        amount_inr: '900',
        category: 'Groceries',
        date: '2026-08-29',
        payment_method: 'bank',
      }),
    )
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/modals/expense-added', params: expect.objectContaining({ amount: '900' }) }),
    )
  })

  it('shows the manual escape hatch when the scan fails', async () => {
    mockLaunchLibrary.mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://cart.png', base64: 'abc123', mimeType: 'image/png', width: 100, height: 100 }],
    })
    ;(scanBill as jest.Mock).mockRejectedValue(new Error('bill scan failed: 502'))

    const { getByText } = renderWithProviders(<ScanBillScreen />)
    await flushCategories()
    fireEvent.press(getByText('Choose a screenshot'))

    await waitFor(() => expect(getByText('Enter manually')).toBeTruthy())
    fireEvent.press(getByText('Enter manually'))
    expect(mockReplace).toHaveBeenCalledWith('/modals/log-expense')
  })
})
