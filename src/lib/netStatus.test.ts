import { setOnline, isOnline } from './netStatus'

beforeEach(() => {
  // Reset to the module's default state before each test.
  setOnline(true)
})

describe('setOnline', () => {
  it('does not flip offline on a single failure', () => {
    setOnline(false)
    expect(isOnline()).toBe(true)
  })

  it('flips offline after two consecutive failures with no success between', () => {
    setOnline(false)
    setOnline(false)
    expect(isOnline()).toBe(false)
  })

  it('a success between two failures resets the streak, so the next single failure does not flip offline', () => {
    setOnline(false)
    setOnline(true)
    setOnline(false)
    expect(isOnline()).toBe(true)
  })

  it('a success always flips back online immediately and resets the streak', () => {
    setOnline(false)
    setOnline(false)
    expect(isOnline()).toBe(false)

    setOnline(true)
    expect(isOnline()).toBe(true)

    // Streak was reset, so a single failure right after recovery still shouldn't flip it.
    setOnline(false)
    expect(isOnline()).toBe(true)
  })
})
