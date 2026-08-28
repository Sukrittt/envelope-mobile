import { act } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { LoadingCaption } from './LoadingCaption'

describe('LoadingCaption', () => {
  it('cycles through the given phrases over time', () => {
    jest.useFakeTimers()
    const phrases = ['First phrase…', 'Second phrase…', 'Third phrase…']
    const { getByText, queryByText } = renderWithProviders(<LoadingCaption phrases={phrases} />)

    const shown = phrases.find((p) => queryByText(p))
    expect(shown).toBeTruthy()

    act(() => {
      jest.advanceTimersByTime(1800)
    })
    const next = phrases.find((p) => queryByText(p))
    expect(next).toBeTruthy()
    expect(next).not.toBe(shown)
    expect(getByText(next as string)).toBeTruthy()

    jest.useRealTimers()
  })
})
