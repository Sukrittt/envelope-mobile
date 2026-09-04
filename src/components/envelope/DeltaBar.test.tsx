import { act, fireEvent } from '@testing-library/react-native'
import { StyleSheet } from 'react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { DeltaBar, DELTA_DELAY, DELTA_DURATION } from './DeltaBar'

jest.useFakeTimers()

function renderBar(props: { from: number; to: number; amount: number }) {
  const utils = renderWithProviders(<DeltaBar {...props} />)
  fireEvent(utils.getByTestId('delta-bar-wrap'), 'layout', { nativeEvent: { layout: { width: 200 } } })
  return utils
}

function settle() {
  act(() => {
    jest.advanceTimersByTime(DELTA_DELAY + DELTA_DURATION + 50)
  })
}

describe('DeltaBar', () => {
  it('parks the ghost marker at the pre-expense position', () => {
    const { getByTestId } = renderBar({ from: 50, to: 80, amount: 10 })
    const style = StyleSheet.flatten(getByTestId('delta-bar-marker').props.style)
    expect(style.left).toBe(100) // 50% of 200px
  })

  it('starts the delta segment where the marker sits', () => {
    const { getByTestId } = renderBar({ from: 50, to: 80, amount: 10 })
    const style = StyleSheet.flatten(getByTestId('delta-bar-delta').props.style)
    expect(style.left).toBe(100)
  })

  it('grows the delta segment to span from -> to', () => {
    const { getByTestId } = renderBar({ from: 50, to: 80, amount: 10 })
    settle()
    const style = StyleSheet.flatten(getByTestId('delta-bar-delta').props.style)
    expect(style.width).toBeCloseTo((30 / 100) * 200)
  })

  it('floors a near-invisible delta to a minimum visible width', () => {
    const { getByTestId } = renderBar({ from: 50, to: 50.1, amount: 1 })
    settle()
    const style = StyleSheet.flatten(getByTestId('delta-bar-delta').props.style)
    expect(style.width).toBeCloseTo((2.4 / 100) * 200)
  })

  it('renders the signed amount on the tag', () => {
    const { getByText } = renderBar({ from: 50, to: 80, amount: 450 })
    expect(getByText('+₹450')).toBeTruthy()
  })
})
