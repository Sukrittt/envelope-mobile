import { isVersionNewer } from './version'

describe('isVersionNewer', () => {
  it.each([
    ['2.3.0', '2.2.1', true],
    ['2.2.1', '2.2.1', false],
    ['2.2.0', '2.2.1', false],
    ['3.0.0', '2.99.99', true],
    ['v2.3.0', '2.2.1', true],
    ['not-a-version', '2.2.1', false],
  ])('compares %s with %s', (latest, installed, expected) => {
    expect(isVersionNewer(latest, installed)).toBe(expected)
  })
})
