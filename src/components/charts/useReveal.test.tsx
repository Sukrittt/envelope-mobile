import { act, renderHook } from '@testing-library/react-native'
import { useReveal } from './useReveal'

let mockFocused = true
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }))

/** Past the hook's settle delay, so the reveal is armed. */
function settle() {
  act(() => {
    jest.advanceTimersByTime(500)
  })
}

beforeEach(() => {
  mockFocused = true
  jest.useFakeTimers()
})

afterEach(() => {
  jest.useRealTimers()
})

describe('useReveal', () => {
  it('holds at 0 until the screen has settled after its transition', () => {
    const { result } = renderHook(() => useReveal('scope', true))
    expect(result.current).toBe(0)

    settle()
    expect(result.current).toBe(1)
  })

  it('holds at 0 until there is data to reveal', () => {
    const { result, rerender } = renderHook<number, { ready: boolean }>(({ ready }) => useReveal('scope', ready), {
      initialProps: { ready: false },
    })
    settle()
    expect(result.current).toBe(0)

    act(() => rerender({ ready: true }))
    expect(result.current).toBe(1)
  })

  it('holds at 0 while the screen is not focused', () => {
    mockFocused = false
    const { result } = renderHook(() => useReveal('scope', true))
    settle()
    expect(result.current).toBe(0)
  })

  it('bumps again when the scope changes', () => {
    const { result, rerender } = renderHook<number, { scope: string }>(({ scope }) => useReveal(scope, true), {
      initialProps: { scope: 'September 2026|category|false' },
    })
    settle()
    expect(result.current).toBe(1)

    act(() => rerender({ scope: 'September 2026|group|false' }))
    expect(result.current).toBe(2)
  })

  it('does not bump on a re-render that leaves the scope alone', () => {
    const { result, rerender } = renderHook<number, { scope: string }>(({ scope }) => useReveal(scope, true), {
      initialProps: { scope: 'scope' },
    })
    settle()
    expect(result.current).toBe(1)

    act(() => rerender({ scope: 'scope' }))
    expect(result.current).toBe(1)
  })
})
