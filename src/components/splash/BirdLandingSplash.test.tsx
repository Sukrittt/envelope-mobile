import { render } from '@testing-library/react-native'

import { BirdLandingSplash } from './BirdLandingSplash'

describe('BirdLandingSplash', () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.runOnlyPendingTimers()
    jest.useRealTimers()
  })

  it('mounts with valid animation transform origins', () => {
    const tree = render(<BirdLandingSplash />).toJSON()
    const origins: unknown[] = []

    const visit = (value: unknown) => {
      if (Array.isArray(value)) {
        value.forEach(visit)
        return
      }
      if (!value || typeof value !== 'object') return

      Object.entries(value).forEach(([key, child]) => {
        if (key === 'transformOrigin') origins.push(child)
        visit(child)
      })
    }

    visit(tree)

    expect(origins.length).toBeGreaterThan(0)
    origins.forEach(origin => expect(origin).toHaveLength(3))
  })
})
