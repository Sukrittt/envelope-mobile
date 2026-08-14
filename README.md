# Envelope (Mobile)

Expo/React Native companion app for the YNAB-inspired envelope budgeting tool. Talks to the same deployed API as `Web/`.

## Stack

- Expo SDK 57 + Expo Router (file-based routing, `app/`)
- React 19 / React Native 0.86
- TanStack Query for data fetching
- expo-secure-store for token persistence

## Structure

```
app/            routes (expo-router): (tabs)/, modals/, unlock.tsx
src/api/        fetch wrappers per resource (budgets, expenses, holdings, ...)
src/hooks/      TanStack Query hooks wrapping src/api
src/components/ envelope, charts, nav, subscriptions, shared UI
src/context/    PrivacyContext
src/theme/      tokens, fonts, ThemeProvider
src/lib/        format/emoji/envelope helpers
```

`src/api/client.ts` and `src/api/accessMode.ts` are ports of `Web/src/services/api.ts` and `accessMode.ts` — same real/guest auth model, but SecureStore is async so `initAccessMode()` must be awaited once at boot before rendering past the splash screen.

## Setup

```bash
npm install
npm start        # expo start
npm run ios       # expo run:ios
npm run android   # expo run:android
npm run web       # expo start --web
```

## Environment

- `EXPO_PUBLIC_API_URL` — API base URL. Defaults to `https://ynab-replacement.vercel.app` if unset.

## Auth

Real mode stores a bearer token (verified against `/api/auth/verify`) in SecureStore for ~30 days. Guest mode sends no auth header. See `app/unlock.tsx` and `src/api/accessMode.ts`.

## Notes

Expo 57 API surface differs from older docs — check `https://docs.expo.dev/versions/v57.0.0/` before assuming behavior (see `AGENTS.md`).
