/** Builds a mocked `apiFetch` response shape for `jest.mock('@/src/api/client', ...)`. */
export function mockApiFetch(body: unknown, init?: { ok?: boolean; status?: number }) {
  const ok = init?.ok ?? true
  const status = init?.status ?? 200
  return jest.fn().mockResolvedValue({
    ok,
    status,
    json: async () => body,
    text: async () => String(body),
  })
}
