import { computeShare, reconcile, type ScanItem } from './split'

describe('computeShare', () => {
  it('counts a "mine" item (divisor 1) in full', () => {
    const items: ScanItem[] = [{ name: 'Milk', price: 60, divisor: 1 }]
    expect(computeShare(items)).toBe(60)
  })

  it('halves a divisor-2 item', () => {
    const items: ScanItem[] = [{ name: 'Pizza', price: 800, divisor: 2 }]
    expect(computeShare(items)).toBe(400)
  })

  it('ignores a skipped item entirely', () => {
    const items: ScanItem[] = [{ name: 'Detergent', price: 380, divisor: null }]
    expect(computeShare(items)).toBe(0)
  })

  it('sums a mixed mine / split / skip list', () => {
    const items: ScanItem[] = [
      { name: 'Milk', price: 60, divisor: 1 },
      { name: 'Pizza', price: 800, divisor: 2 },
      { name: 'Detergent', price: 380, divisor: null },
    ]
    expect(computeShare(items)).toBe(460)
  })

  it('returns 0 for an empty list', () => {
    expect(computeShare([])).toBe(0)
  })

  it('rounds to 2dp instead of drifting on float division', () => {
    const items: ScanItem[] = [{ name: 'Snacks', price: 100, divisor: 3 }]
    expect(computeShare(items)).toBe(33.33)
  })
})

describe('reconcile', () => {
  it('appends a Fees & taxes row for the delivery-fee gap', () => {
    const items = [{ name: 'Milk', price: 60 }, { name: 'Bread', price: 40 }]
    expect(reconcile(120, items)).toEqual([...items, { name: 'Fees & taxes', price: 20 }])
  })

  it('is a no-op when items already sum to the total', () => {
    const items = [{ name: 'Milk', price: 60 }]
    expect(reconcile(60, items)).toEqual(items)
  })

  it('is a no-op for sub-paisa float noise', () => {
    const items = [{ name: 'Milk', price: 33.33 }, { name: 'Bread', price: 33.33 }, { name: 'Eggs', price: 33.34 }]
    expect(reconcile(100, items)).toEqual(items)
  })

  it('appends a negative row when the total is less than the item sum', () => {
    const items = [{ name: 'Milk', price: 60 }]
    expect(reconcile(50, items)).toEqual([...items, { name: 'Fees & taxes', price: -10 }])
  })
})
