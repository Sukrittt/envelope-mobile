import { dragShift, dragTarget, moveItem } from './dragReorder'

describe('dragTarget', () => {
  it('rounds the drag distance to whole rows', () => {
    expect(dragTarget(1, 0, 50, 5)).toBe(1)
    expect(dragTarget(1, 24, 50, 5)).toBe(1)
    expect(dragTarget(1, 26, 50, 5)).toBe(2)
    expect(dragTarget(3, -120, 50, 5)).toBe(1)
  })

  it('clamps to the ends of the list', () => {
    expect(dragTarget(0, -500, 50, 5)).toBe(0)
    expect(dragTarget(4, 500, 50, 5)).toBe(4)
  })

  it('stays put before a row height is known', () => {
    expect(dragTarget(2, 300, 0, 5)).toBe(2)
  })
})

describe('dragShift', () => {
  it('slides rows between start and target up when dragging down', () => {
    expect([0, 1, 2, 3, 4].map((i) => dragShift(i, 1, 3))).toEqual([0, 0, -1, -1, 0])
  })

  it('slides rows between target and start down when dragging up', () => {
    expect([0, 1, 2, 3, 4].map((i) => dragShift(i, 3, 1))).toEqual([0, 1, 1, 0, 0])
  })

  it('leaves everything alone when the target is the start', () => {
    expect([0, 1, 2].map((i) => dragShift(i, 1, 1))).toEqual([0, 0, 0])
  })
})

describe('moveItem', () => {
  it('moves an item to the target index', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 'a', 2)).toEqual(['b', 'c', 'a', 'd'])
    expect(moveItem(['a', 'b', 'c', 'd'], 'd', 0)).toEqual(['d', 'a', 'b', 'c'])
  })

  it('returns the same list for an unknown item', () => {
    const list = ['a', 'b']
    expect(moveItem(list, 'z', 0)).toBe(list)
  })
})
