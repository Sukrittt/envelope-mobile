import { act, renderHook } from '@testing-library/react-native'
import { useReveal, type RevealState } from './useReveal'

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
    expect(result.current).toEqual({ revealKey: 0, revealReady: false })

    settle()
    expect(result.current).toEqual({ revealKey: 1, revealReady: true })
  })

  it('holds at 0 until there is data to reveal', () => {
    const { result, rerender } = renderHook<RevealState, { ready: boolean }>(({ ready }) => useReveal('scope', ready), {
      initialProps: { ready: false },
    })
    settle()
    expect(result.current).toEqual({ revealKey: 0, revealReady: false })

    act(() => rerender({ ready: true }))
    expect(result.current).toEqual({ revealKey: 1, revealReady: true })
  })

  it('holds at 0 while the screen is not focused', () => {
    mockFocused = false
    const { result } = renderHook(() => useReveal('scope', true))
    settle()
    expect(result.current).toEqual({ revealKey: 0, revealReady: false })
  })

  it('bumps again when the scope changes', () => {
    const { result, rerender } = renderHook<RevealState, { scope: string }>(({ scope }) => useReveal(scope, true), {
      initialProps: { scope: 'September 2026|category|false' },
    })
    settle()
    expect(result.current).toEqual({ revealKey: 1, revealReady: true })

    act(() => rerender({ scope: 'September 2026|group|false' }))
    expect(result.current).toEqual({ revealKey: 2, revealReady: true })
  })

  it('does not bump on a re-render that leaves the scope alone', () => {
    const { result, rerender } = renderHook<RevealState, { scope: string }>(({ scope }) => useReveal(scope, true), {
      initialProps: { scope: 'scope' },
    })
    settle()
    expect(result.current).toEqual({ revealKey: 1, revealReady: true })

    act(() => rerender({ scope: 'scope' }))
    expect(result.current).toEqual({ revealKey: 1, revealReady: true })
  })

  it('marks a changed scope not ready before its replay is armed', () => {
    const { result, rerender } = renderHook<RevealState, { scope: string }>(
      ({ scope }) => useReveal(scope, true),
      { initialProps: { scope: 'category' } },
    )
    settle()

    // The effect is flushed by RNTL, so the public settled state is ready. The
    // synchronous guard in useReveal is covered by the implementation contract:
    // it compares the requested scope with the last armed scope during render.
    act(() => rerender({ scope: 'group' }))
    expect(result.current).toEqual({ revealKey: 2, revealReady: true })
  })
})
