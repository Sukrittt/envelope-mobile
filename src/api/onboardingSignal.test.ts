import { onOnboarded, signalOnboarded } from './onboardingSignal'

describe('onboardingSignal', () => {
  it('calls every subscribed callback on signal', () => {
    const a = jest.fn()
    const b = jest.fn()
    onOnboarded(a)
    onOnboarded(b)
    signalOnboarded()
    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('stops calling a callback after it unsubscribes', () => {
    const fn = jest.fn()
    const unsubscribe = onOnboarded(fn)
    unsubscribe()
    signalOnboarded()
    expect(fn).not.toHaveBeenCalled()
  })

  it('does not throw when signaled with no subscribers', () => {
    expect(() => signalOnboarded()).not.toThrow()
  })
})
