// react-native-safe-area-context 5.x ships its jest mock as a named export
// (jest/mock.tsx) rather than the older `jest/setup.js` side-effect import.
// Wired via jest.mock (not moduleNameMapper) — the mock file itself calls
// jest.requireActual('react-native-safe-area-context'), and moduleNameMapper
// would re-intercept that call too, recursing forever.
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default)

// src/api/client.ts throws at import time in __DEV__ if this is unset (a
// deliberate fail-loud guard for real dev builds). jest-expo runs with
// __DEV__ true, so any test that transitively imports client.ts needs this
// set before that import happens, even in files that don't touch the API.
process.env.EXPO_PUBLIC_API_URL = 'http://localhost:3000'

// src/lib/analytics.ts has the same import-time throw, for the same reason.
process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test'

// Constructing a real PostHog client registers an AppState listener and a
// flush timer that outlive the test, and it would try to reach the network.
// Global rather than per-file: analytics.ts is imported by app/_layout.tsx.
jest.mock('posthog-react-native', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    identify: jest.fn(),
    reset: jest.fn(),
    screen: jest.fn(),
    capture: jest.fn(),
  })),
}))

// src/api/workos.ts calls AuthSession.makeRedirectUri() at import time,
// which needs expo-constants' native manifest (app.json's `scheme`) to
// resolve a URI scheme — unavailable under Jest. This throws on import in
// ANY test that transitively pulls in src/api/accessMode.ts (client.ts,
// ThemeProvider, PrivacyContext all do), so it needs a global mock here
// rather than per-file.
jest.mock('expo-auth-session', () => ({
  ...jest.requireActual('expo-auth-session'),
  makeRedirectUri: jest.fn(() => 'https://example.com/callback'),
}))

// expo-crypto's native module resolves to a no-op proxy under Jest (no real
// device), so randomUUID() silently returns undefined instead of a uuid.
// Global rather than per-file: offline sync mints a client_id from this in
// several places (src/api/expenses.ts, the pending-expense queue).
jest.mock('expo-crypto', () => {
  let counter = 0
  return { randomUUID: jest.fn(() => `test-uuid-${++counter}`) }
})

// @react-native-async-storage/async-storage's native module is unavailable
// under Jest — this is the package's own documented in-memory mock. Global
// rather than per-file: offline sync (src/lib/pendingExpenses.ts,
// src/lib/categoryCache.ts) pulls it into most of the app's screens now.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
)

// GestureDetector's internals reach for reanimated APIs (useEvent) that the
// hand-written reanimated mock in __mocks__ deliberately doesn't implement,
// and it also demands a GestureHandlerRootView ancestor that unit tests have
// no reason to mount. RNTL can't simulate a drag anyway, so gesture behaviour
// is verified by hand and the detector is a pass-through here. Global because
// loading the real module in every suite that reaches it is slow enough to
// trip test timeouts.
jest.mock('react-native-gesture-handler', () => ({
  ...jest.requireActual('react-native-gesture-handler'),
  GestureDetector: ({ children }) => children,
}))
