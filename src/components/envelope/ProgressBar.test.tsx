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
})
