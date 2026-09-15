// Shared math for the PanResponder drag-to-reorder lists (categories and groups on Envelopes).
// Every row in a list is assumed to be `step` tall, gap included. dragTarget and dragShift are
// worklets so the group drag can run them on the UI thread.

/** Index the dragged row would land on after moving `dy` pixels from `start`. */
export function dragTarget(start: number, dy: number, step: number, count: number): number {
  'worklet'
  if (count <= 0 || step <= 0) return start
  return Math.min(count - 1, Math.max(0, start + Math.round(dy / step)))
}

/** How many slots a non-dragged row at `i` slides (-1 up, 1 down) to make room. */
export function dragShift(i: number, start: number, target: number): number {
  'worklet'
  if (target > start && i > start && i <= target) return -1
  if (target < start && i >= target && i < start) return 1
  return 0
}

/** Returns a copy of `list` with `item` moved to `toIndex`. Unknown items leave it unchanged. */
export function moveItem<T>(list: T[], item: T, toIndex: number): T[] {
  const idx = list.indexOf(item)
  if (idx === -1) return list
  const next = [...list]
  next.splice(idx, 1)
  next.splice(toIndex, 0, item)
  return next
}
