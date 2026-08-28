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
