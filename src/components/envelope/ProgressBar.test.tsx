import { StyleSheet } from 'react-native'
import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { lightTokens } from '@/src/theme/tokens'
import { ProgressBar } from './ProgressBar'

// react-native's jest preset defaults useColorScheme() to 'light', so the
// default render in tests uses lightTokens.

function fillStyle(pct: number) {
  const { getByTestId } = renderWithProviders(<ProgressBar pct={pct} />)
  const flat = getByTestId('progress-bar-fill').props.style.flat()
  return Object.assign({}, ...flat)
}

describe('ProgressBar', () => {
  it('uses text3 (muted) when exactly at 100%', () => {
    expect(fillStyle(100).backgroundColor).toBe(lightTokens.text3)
  })

  it('uses coral above 90%', () => {
    expect(fillStyle(95).backgroundColor).toBe(lightTokens.coral)
  })

  it('uses warn above 75%', () => {
    expect(fillStyle(80).backgroundColor).toBe(lightTokens.warn)
  })

  it('uses mint at or below 75%', () => {
    expect(fillStyle(50).backgroundColor).toBe(lightTokens.mint)
  })

  it('clamps width to 100 for values over 100', () => {
    expect(fillStyle(150).width).toBe('100%')
  })

  it('clamps width to 0 for negative values', () => {
    expect(fillStyle(-10).width).toBe('0%')
  })

  // The whole point of `from` is the starting position: the bar has to sit at
  // the pre-expense fill during the delay, not at zero.
  it('holds the animated fill at `from` until the tween runs', () => {
    const { getByTestId } = renderWithProviders(<ProgressBar pct={80} from={50} />)
    fireEvent(getByTestId('progress-bar-track'), 'layout', { nativeEvent: { layout: { width: 200 } } })
    const width = StyleSheet.flatten(getByTestId('progress-bar-fill').props.style).width
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((width as any)._value ?? width).toBe(100)
  })

  // The animated fill tweens from `from` to `pct`; the colour is the state it
  // ends in, not the one it left.
  it('colours the animated fill by the destination, not the start', () => {
    const { getByTestId } = renderWithProviders(<ProgressBar pct={80} from={50} />)
    // Animated.View flattens its own style, so this branch is a plain object.
    expect(StyleSheet.flatten(getByTestId('progress-bar-fill').props.style).backgroundColor).toBe(lightTokens.warn)
  })
})
