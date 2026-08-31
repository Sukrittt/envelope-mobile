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

// total (900) exceeds the item sum (860) by 40 — a delivery-fee gap that's
// tracked separately from the items now and split across a people-count
// (default 2), rather than folded into the item list as an extra row.
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

async function scanToReview(getByText: (t: string) => unknown) {
  fireEvent.press(getByText('Choose a screenshot') as never)
  await waitFor(() => expect(scanBill).toHaveBeenCalled())
}

beforeEach(() => {
  jest.clearAllMocks()
  ;(getCategories as jest.Mock).mockResolvedValue(CATEGORIES)
  ;(getExpenses as jest.Mock).mockResolvedValue([])
  mockRequestLibrary.mockResolvedValue({ granted: true })
  mockRequestCamera.mockResolvedValue({ granted: true })
  mockLaunchLibrary.mockResolvedValue({
    canceled: false,
    assets: [{ uri: 'file://cart.png', base64: 'abc123', mimeType: 'image/png', width: 100, height: 100 }],
  })
})

describe('ScanBillScreen', () => {
  it('goes back when the picker is cancelled', async () => {
    mockLaunchLibrary.mockResolvedValue({ canceled: true, assets: null })
    const { getByText } = renderWithProviders(<ScanBillScreen />)

    fireEvent.press(getByText('Choose a screenshot'))
    await waitFor(() => expect(mockBack).toHaveBeenCalled())
  })

  it('scans, reviews the fee-adjusted share, and confirms through the breakdown screen', async () => {
    ;(scanBill as jest.Mock).mockResolvedValue(SCAN_RESULT)
    ;(addExpense as jest.Mock).mockResolvedValue({ id: 'e1', timestamp: '2026-08-29T10:00:00' })

    const { getByText, getByDisplayValue } = renderWithProviders(<ScanBillScreen />)

    // Categories load asynchronously — flush that before picking, or the
    // screen would (correctly) refuse to scan with an empty category list.
    await flushCategories()
    await scanToReview(getByText)

    // react-query invokes the mutationFn with a second (client/meta) argument —
    // only the first is ours to assert on.
    expect((scanBill as jest.Mock).mock.calls[0][0]).toEqual({
      image: 'abc123',
      mimeType: 'image/png',
      categories: ['Groceries'],
    })

    // Items default "mine" (60+800=860); the 40 fee gap defaults to a 2-person
    // split (20), so my share is 880, not the full 900.
    await waitFor(() => expect(getByText('₹880')).toBeTruthy())
    expect(getByText('of ₹900 bill')).toBeTruthy()
    expect(getByDisplayValue('Blinkit')).toBeTruthy()

    fireEvent.press(getByText('Review ₹880 →'))

    await waitFor(() => expect(getByText('Log ₹880 to Groceries')).toBeTruthy())
    fireEvent.press(getByText('Log ₹880 to Groceries'))

    await waitFor(() =>
      expect(addExpense).toHaveBeenCalledWith({
        item: 'Blinkit',
        amount_inr: '880',
        category: 'Groceries',
        date: '2026-08-29',
        payment_method: 'bank',
      }),
    )
    expect(mockReplace).toHaveBeenCalledWith(
      expect.objectContaining({ pathname: '/modals/expense-added', params: expect.objectContaining({ amount: '880' }) }),
    )
  })

  it('recomputes the share when the fee people-count changes', async () => {
    ;(scanBill as jest.Mock).mockResolvedValue(SCAN_RESULT)
    const { getByText } = renderWithProviders(<ScanBillScreen />)

    await flushCategories()
    await scanToReview(getByText)
    await waitFor(() => expect(getByText('₹880')).toBeTruthy())

    // 40 fee split 3 ways = 13.33, on top of the unchanged 860 of items.
    fireEvent.press(getByText('3'))
    await waitFor(() => expect(getByText('₹873.33')).toBeTruthy())
  })

  it('applies a bulk split to multiple selected items', async () => {
    ;(scanBill as jest.Mock).mockResolvedValue(SCAN_RESULT)
    const { getByText } = renderWithProviders(<ScanBillScreen />)

    await flushCategories()
    await scanToReview(getByText)
    await waitFor(() => expect(getByText('₹880')).toBeTruthy())

    fireEvent.press(getByText('Select'))
    fireEvent.press(getByText('Milk'))
    fireEvent.press(getByText('Pizza'))
    fireEvent.press(getByText('÷2'))

    // Both items now halved: (60/2 + 800/2) + the unchanged 20 fee share = 450.
    await waitFor(() => expect(getByText('₹450')).toBeTruthy())
  })

  it('filters items by search query', async () => {
    ;(scanBill as jest.Mock).mockResolvedValue(SCAN_RESULT)
    const { getByText, getByPlaceholderText, queryByDisplayValue } = renderWithProviders(<ScanBillScreen />)

    await flushCategories()
    await scanToReview(getByText)
    await waitFor(() => expect(getByText('₹880')).toBeTruthy())

    fireEvent.changeText(getByPlaceholderText('Search items'), 'pizza')
    expect(queryByDisplayValue('Milk')).toBeNull()
    expect(queryByDisplayValue('Pizza')).toBeTruthy()
  })

  it('shows the manual escape hatch when the scan fails', async () => {
    ;(scanBill as jest.Mock).mockRejectedValue(new Error('bill scan failed: 502'))

    const { getByText } = renderWithProviders(<ScanBillScreen />)
    await flushCategories()
    fireEvent.press(getByText('Choose a screenshot'))

    await waitFor(() => expect(getByText('Enter manually')).toBeTruthy())
    fireEvent.press(getByText('Enter manually'))
    expect(mockReplace).toHaveBeenCalledWith('/modals/log-expense')
  })
})
