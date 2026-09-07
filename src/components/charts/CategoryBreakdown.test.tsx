import { act, fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { CategoryBreakdown } from './CategoryBreakdown'
import type { BreakdownRow } from '@/src/lib/monthly'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({
  useIsFocused: () => true,
  useRouter: () => ({ push: mockPush }),
}))

const rows: BreakdownRow[] = [
  { key: 'Investments', label: 'Investments', emoji: '📈', spent: 40000, assigned: 40000, assignedIsCarried: false, pct: 80 },
  { key: 'Cook', label: 'Cook', emoji: '🧑‍🍳', spent: 8000, assigned: 8000, assignedIsCarried: false, pct: 16 },
  { key: 'Travel', label: 'Travel', emoji: '🛵', spent: 2000, assigned: 3000, assignedIsCarried: false, pct: 4 },
]

function renderBreakdown(monthLabel = 'September 2026', selectedKey: string | null = null) {
  const onSelectKey = jest.fn()
  const result = renderWithProviders(
    <CategoryBreakdown
      rows={rows}
      mode="category"
      onModeChange={jest.fn()}
      fixedCategories={new Set()}
      variableOnly={false}
      onToggleVariableOnly={jest.fn()}
      selectedKey={selectedKey}
      onSelectKey={onSelectKey}
      comparison={null}
      leftover={1000}
      monthLabel={monthLabel}
    />,
  )
  act(() => jest.advanceTimersByTime(500))
  return { ...result, onSelectKey }
}

beforeEach(() => {
  jest.useFakeTimers()
  mockPush.mockClear()
})

afterEach(() => jest.useRealTimers())

describe('CategoryBreakdown filtering', () => {
  it('keeps rows laid out but invisible until the entrance reveal is armed', () => {
    const onSelectKey = jest.fn()
    const screen = renderWithProviders(
      <CategoryBreakdown
        rows={rows}
        mode="category"
        onModeChange={jest.fn()}
        fixedCategories={new Set()}
        variableOnly={false}
        onToggleVariableOnly={jest.fn()}
        selectedKey={null}
        onSelectKey={onSelectKey}
        comparison={null}
        leftover={1000}
        monthLabel="September 2026"
      />,
    )

    expect(screen.getByTestId('breakdown-reveal-content').props.style).toContainEqual({ opacity: 0 })
    act(() => jest.advanceTimersByTime(500))
    expect(screen.getByTestId('breakdown-reveal-content').props.style).toContainEqual({ opacity: 1 })
  })

  it('keeps edits as a draft until Apply and then reports hidden items', () => {
    const screen = renderBreakdown()
    fireEvent.press(screen.getByLabelText('Filter chart'))
    fireEvent.press(screen.getByRole('checkbox', { name: 'Investments' }))

    // The chart copy behind the modal is unchanged while the choice is a draft.
    expect(screen.getAllByText('Investments').length).toBeGreaterThan(0)

    fireEvent.press(screen.getByRole('button', { name: 'Apply' }))
    act(() => jest.advanceTimersByTime(250))

    expect(screen.getByLabelText('Filter, 1 hidden')).toBeTruthy()
    expect(screen.queryByText('Investments')).toBeNull()
    expect(screen.getByText('Filtered total')).toBeTruthy()
  })

  it('discards draft edits on Cancel', () => {
    const screen = renderBreakdown()
    fireEvent.press(screen.getByLabelText('Filter chart'))
    fireEvent.press(screen.getByRole('checkbox', { name: 'Investments' }))
    fireEvent.press(screen.getByRole('button', { name: 'Cancel' }))

    expect(screen.getByLabelText('Filter chart')).toBeTruthy()
    expect(screen.getAllByText('Investments').length).toBeGreaterThan(0)
  })

  it('requires at least one included item and Select all restores the draft', () => {
    const screen = renderBreakdown()
    fireEvent.press(screen.getByLabelText('Filter chart'))
    for (const label of ['Investments', 'Cook', 'Travel']) {
      fireEvent.press(screen.getByRole('checkbox', { name: label }))
    }

    expect(screen.getByText('Keep at least one item in the chart.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Apply' }).props.accessibilityState.disabled).toBe(true)

    fireEvent.press(screen.getByLabelText('Select all categories'))
    expect(screen.getByRole('checkbox', { name: 'Investments' }).props.accessibilityState.checked).toBe(true)
  })

  it('clears a highlighted category when Apply excludes it', () => {
    const screen = renderBreakdown('September 2026', 'Investments')
    fireEvent.press(screen.getByLabelText('Filter chart'))
    fireEvent.press(screen.getByRole('checkbox', { name: 'Investments' }))
    fireEvent.press(screen.getByRole('button', { name: 'Apply' }))
    act(() => jest.advanceTimersByTime(250))

    expect(screen.onSelectKey).toHaveBeenCalledWith(null)
  })
})
