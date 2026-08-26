import { fireEvent } from '@testing-library/react-native'
import { renderWithProviders } from '@/src/test-utils/renderWithProviders'
import { FloatingNav, slotOffset, indexFromOffset, addSlotShift } from './FloatingNav'

// RNTL can't simulate a real drag/snap gesture, so drag-to-navigate is
// covered by hand (see the plan's verification steps), not here.

describe('slotOffset / indexFromOffset', () => {
  it('round-trips slot offsets back to their index', () => {
    for (let i = 0; i < 5; i++) {
      expect(indexFromOffset(slotOffset(i), 5)).toBe(i)
    }
  })

  it('rounds a mid-drag offset to the nearest slot', () => {
    expect(indexFromOffset(slotOffset(1) + 1, 5)).toBe(1)
    expect(indexFromOffset(slotOffset(2) - 30, 5)).toBe(2)
  })

  it('clamps below the first and above the last slot', () => {
    expect(indexFromOffset(-1000, 5)).toBe(0)
    expect(indexFromOffset(1000, 5)).toBe(4)
  })
})

describe('addSlotShift', () => {
  it('is positive (add slot to the right) for slots left of the add slot', () => {
    expect(addSlotShift('index')).toBeGreaterThan(0)
    expect(addSlotShift('activity')).toBeGreaterThan(0)
  })

  it('is negative (add slot to the left) for slots right of the add slot', () => {
    expect(addSlotShift('envelopes')).toBeLessThan(0)
    expect(addSlotShift('more')).toBeLessThan(0)
  })

  it('is a fixed multiple of the slot width, and shrinks with distance to the add slot', () => {
    expect(addSlotShift('index')).toBe(144)
    expect(addSlotShift('activity')).toBe(72)
  })
})

describe('FloatingNav', () => {
  it('taps a route circle and calls onSelect with its name', () => {
    const onSelect = jest.fn()
    const { getByLabelText } = renderWithProviders(
      <FloatingNav active="index" onSelect={onSelect} onAdd={jest.fn()} />,
    )
    fireEvent.press(getByLabelText('Envelopes'))
    expect(onSelect).toHaveBeenCalledWith('envelopes')
  })

  it('taps the add circle and calls onAdd', () => {
    const onAdd = jest.fn()
    const { getByLabelText } = renderWithProviders(
      <FloatingNav active="index" onSelect={jest.fn()} onAdd={onAdd} />,
    )
    fireEvent.press(getByLabelText('Log expense'))
    expect(onAdd).toHaveBeenCalled()
  })

  it('marks the active route selected and the others not', () => {
    const { getByLabelText } = renderWithProviders(
      <FloatingNav active="envelopes" onSelect={jest.fn()} onAdd={jest.fn()} />,
    )
    expect(getByLabelText('Envelopes').props.accessibilityState.selected).toBe(true)
    expect(getByLabelText('Home').props.accessibilityState.selected).toBe(false)
  })

  it('marks the add slot selected when addActive, with a Close label', () => {
    const { getByLabelText, queryByLabelText } = renderWithProviders(
      <FloatingNav active={null} addActive onSelect={jest.fn()} onAdd={jest.fn()} />,
    )
    expect(getByLabelText('Close').props.accessibilityState.selected).toBe(true)
    expect(queryByLabelText('Log expense')).toBeNull()
  })
})
