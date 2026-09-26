# Contributing to Aviary (Android)

Thanks for helping out. Issues labelled `good first issue` are a good place to start.

## Setup

```bash
npm install
echo "EXPO_PUBLIC_API_URL=http://<your-machine-ip>:3000" > .env   # a local Web server
npm run android
```

Run the API from [`Sukrittt/aviary`](https://github.com/Sukrittt/aviary) locally. Dev builds refuse to start without `EXPO_PUBLIC_API_URL`, so they never touch production data. Expo SDK 57 differs from older docs; check https://docs.expo.dev/versions/v57.0.0/.

## Before opening a PR

```bash
npm run lint
npm run typecheck
npm test
```

- Open PRs against `main`.
- Keep PRs focused on one change, and include a screenshot or clip for UI changes.
- Budget math and bug fixes need a test. Bug fixes should include a failing test that reproduces the bug.
- Never commit `google-services.json`, `.env`, or keys.

## Reporting bugs

Open an issue with device, Android version, app version, and steps to reproduce. For security issues, email sukritsaha27@gmail.com instead of opening a public issue.
