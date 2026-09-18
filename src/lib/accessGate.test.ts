import { isAccessBlocked, markAccessAllowed, markAccessBlocked, onAccessChange } from './accessGate'

afterEach(() => markAccessAllowed())

it('starts open', () => {
  expect(isAccessBlocked()).toBe(false)
})

it('notifies subscribers when the API refuses a request', () => {
  const seen: boolean[] = []
  const off = onAccessChange((b) => seen.push(b))
  markAccessBlocked()
  markAccessAllowed()
  off()
  expect(seen).toEqual([true, false])
})

it('does not re-notify on a repeat of the same state', () => {
  // apiFetch calls markAccessBlocked() on every 402, and a blocked app fires
  // plenty of them — each one re-rendering every subscriber would be noise.
  const fn = jest.fn()
  markAccessBlocked()
  const off = onAccessChange(fn)
  markAccessBlocked()
  markAccessBlocked()
  off()
  expect(fn).not.toHaveBeenCalled()
})

it('stops notifying after unsubscribe', () => {
  const fn = jest.fn()
  onAccessChange(fn)()
  markAccessBlocked()
  expect(fn).not.toHaveBeenCalled()
})
