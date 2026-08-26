import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { DatePicker } from './DatePicker'

describe('DatePicker (single)', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date(2026, 7, 22)) // Sat 22 Aug 2026
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it('shows a 6-day strip ending today, and highlights the selected day', () => {
    const { getByText } = renderWithProviders(<DatePicker mode="single" value="2026-08-19" onChange={jest.fn()} />)
    expect(getByText('Today')).toBeTruthy()
    expect(getByText('Yest')).toBeTruthy()
    expect(getByText('22')).toBeTruthy()
    expect(getByText('3 days ago')).toBeTruthy()
  })

  it('picks a strip day without opening the calendar', () => {
    const onChange = jest.fn()
    const { getByText, queryByText } = renderWithProviders(<DatePicker mode="single" value="2026-08-19" onChange={onChange} />)
    fireEvent.press(getByText('Today'))
    expect(onChange).toHaveBeenCalledWith('2026-08-22')
    expect(queryByText('Close calendar')).toBeNull()
  })

  it('toggles the calendar via "Another date..." / "Close calendar"', () => {
    const { getByText, queryByText } = renderWithProviders(<DatePicker mode="single" value="2026-08-19" onChange={jest.fn()} />)
    expect(queryByText('August 2026')).toBeNull()
    fireEvent.press(getByText('Another date...'))
    expect(getByText('August 2026')).toBeTruthy()
    fireEvent.press(getByText('Close calendar'))
    expect(queryByText('August 2026')).toBeNull()
  })
})
