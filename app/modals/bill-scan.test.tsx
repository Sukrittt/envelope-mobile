import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import BillScanModal from './bill-scan'
import type { BillScanDetail } from '@/src/api/bills'

const mockBack = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, replace: jest.fn(), push: jest.fn(), navigate: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'b1' }),
}))

const mockUseBillScan = jest.fn()
jest.mock('@/src/hooks/useBillScans', () => ({
  useBillScan: (id: string) => mockUseBillScan(id),
}))

function detail(overrides: Partial<BillScanDetail>): BillScanDetail {
  return {
    id: 'b1',
    merchant: 'Blinkit',
    category: '🛒 Groceries',
    date: '2026-09-01',
    total: 900,
    my_share: 880,
    people_count: 2,
    items: [
      { name: 'Milk', price: 60, qty: 1, divisor: 1 },
      { name: 'Pizza', price: 800, qty: 1, divisor: 2 },
    ],
    expense_id: 'e1',
    image_status: 'ready',
    image_url: 'https://blob.example/signed',
    created_at: '2026-09-01T10:00:00+05:30',
    ...overrides,
  }
}

beforeEach(() => {
  mockBack.mockClear()
  mockUseBillScan.mockReset()
})

it('shows a loading phrase while the detail is still loading', () => {
  mockUseBillScan.mockReturnValue({ data: undefined, isLoading: true })
  const { getByText } = renderWithProviders(<BillScanModal />)
  expect(getByText('Pulling up this scan…')).toBeTruthy()
})

it("shows a not-found message when the scan doesn't resolve", () => {
  mockUseBillScan.mockReturnValue({ data: undefined, isLoading: false })
  const { getByText } = renderWithProviders(<BillScanModal />)
  expect(getByText("Couldn't find that scan.")).toBeTruthy()
})

it('renders merchant, category, total, split, and each item with its share label', () => {
  mockUseBillScan.mockReturnValue({ data: detail({}), isLoading: false })
  const { getByText, getAllByText } = renderWithProviders(<BillScanModal />)

  expect(getAllByText('Blinkit').length).toBeGreaterThan(0)
  expect(getByText('Groceries · 1 Sep 2026')).toBeTruthy()
  expect(getByText('₹900')).toBeTruthy() // bill total
  expect(getByText('₹880')).toBeTruthy() // my share
  expect(getByText('2 people')).toBeTruthy()

  expect(getByText('Milk')).toBeTruthy()
  expect(getByText('Yours')).toBeTruthy()
  expect(getByText('Pizza')).toBeTruthy()
  expect(getByText('Split ÷2')).toBeTruthy()
})

it('labels an unassigned (skipped) item as not yours', () => {
  mockUseBillScan.mockReturnValue({
    data: detail({ items: [{ name: 'Delivery fee', price: 40, qty: 1, divisor: null }] }),
    isLoading: false,
  })
  const { getByText } = renderWithProviders(<BillScanModal />)
  expect(getByText('Not yours')).toBeTruthy()
})

it('shows a pending placeholder instead of the photo while the upload is still in flight', () => {
  mockUseBillScan.mockReturnValue({
    data: detail({ image_status: 'pending', image_url: null }),
    isLoading: false,
  })
  const { getByText } = renderWithProviders(<BillScanModal />)
  expect(getByText('Photo still uploading…')).toBeTruthy()
})
