import { ScrollView, StyleSheet } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import BillScansScreen from './bill-scans'
import type { BillScanSummary } from '@/src/api/bills'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn(), replace: jest.fn(), navigate: jest.fn() }),
}))

const mockUseBillScans = jest.fn()
jest.mock('@/src/hooks/useBillScans', () => ({
  useBillScans: () => mockUseBillScans(),
}))

jest.mock('@/src/lib/netStatus', () => ({ useOnline: () => true }))

function row(overrides: Partial<BillScanSummary>): BillScanSummary {
  return {
    id: 'b1',
    merchant: 'Blinkit',
    category: '🛒 Groceries',
    date: '2026-09-01',
    total: 900,
    my_share: 880,
    people_count: 2,
    item_count: 2,
    image_status: 'ready',
    created_at: '2026-09-01T10:00:00+05:30',
    ...overrides,
  }
}

function render(rows: BillScanSummary[], loading = false) {
  mockUseBillScans.mockReturnValue({ data: rows, isLoading: loading })
  return renderWithProviders(<BillScansScreen />)
}

beforeEach(() => {
  mockPush.mockClear()
  mockUseBillScans.mockReset()
})

describe('empty state', () => {
  it('explains what the screen is for when nothing has been scanned yet', () => {
    const { getByText } = render([])
    expect(getByText('Nothing scanned yet')).toBeTruthy()
    expect(getByText('No scans yet')).toBeTruthy()
  })
})

describe('rows', () => {
  it('shows merchant, category, date, item count and the logged share', () => {
    const { getByText, getAllByText } = render([row({})])
    expect(getByText('Blinkit')).toBeTruthy()
    expect(getByText('Groceries · 1 Sep · 2 items')).toBeTruthy()
    expect(getAllByText('₹880').length).toBeGreaterThan(0)
    expect(getByText('1 scanned')).toBeTruthy()
  })

  it('opens the scan detail for the row that was tapped', () => {
    const { getByText } = render([row({ id: 'b7', merchant: 'Zomato' })])
    fireEvent.press(getByText('Zomato'))
    expect(mockPush).toHaveBeenCalledWith('/modals/bill-scan?id=b7')
  })

  it('singularizes the item count for a one-item scan', () => {
    const { getByText } = render([row({ item_count: 1 })])
    expect(getByText('Groceries · 1 Sep · 1 item')).toBeTruthy()
  })
})


describe('loading layout', () => {
  it('centers loading phrases in the available viewport without a vertical offset', () => {
    const screen = render([], true)
    const scroll = screen.UNSAFE_getByType(ScrollView)
    expect(StyleSheet.flatten(scroll.props.style)).toMatchObject({ flex: 1 })
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle)).toMatchObject({
      flexGrow: 1, alignItems: 'center', justifyContent: 'center',
    })
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).marginTop).toBeUndefined()
  })
})


describe('summary', () => {
  it('shows the logged shares, not the full bill totals', () => {
    const { getByText, getByLabelText } = render([
      row({ my_share: 300, total: 900 }),
      row({ id: 'b2', category: 'Food', my_share: 100, total: 600, item_count: 3 }),
    ])
    expect(getByText('Bills Scanned')).toBeTruthy()
    expect(getByText('Your share logged')).toBeTruthy()
    expect(getByLabelText('₹400')).toBeTruthy()
    expect(getByText('2 bills · 5 items')).toBeTruthy()
  })
})
