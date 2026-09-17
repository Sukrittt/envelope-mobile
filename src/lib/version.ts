function numericParts(version: string): number[] | null {
  const stable = version.trim().replace(/^v/i, '').split(/[+-]/, 1)[0]
  if (!/^\d+(?:\.\d+)*$/.test(stable)) return null
  return stable.split('.').map(Number)
}

/** True only when both values are numeric versions and `latest` is newer. */
export function isVersionNewer(latest: string, installed: string): boolean {
  const next = numericParts(latest)
  const current = numericParts(installed)
  if (!next || !current) return false

  const length = Math.max(next.length, current.length)
  for (let i = 0; i < length; i += 1) {
    const difference = (next[i] ?? 0) - (current[i] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return false
}
