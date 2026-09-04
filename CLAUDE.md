@AGENTS.md

# graphify

Use the graphify skill whenever possible:

- Before answering any question about codebase, architecture, file relationships, or project content, query the graph first (`graphify query "<question>"`, `graphify path "A" "B"`, `graphify explain "<concept>"`) instead of grepping/reading files directly.
- After code changes, keep the graph fresh: run `/graphify --update` (or rely on the post-commit hook if installed).
- Use `.graphify/wiki/index.md` first when present; fall back to `.graphify/GRAPH_REPORT.md` only for broad reviews.
- If `.graphify/needs_update` exists or the graph is stale, warn and update before trusting semantic results.
- Only skip graphify when the question is trivially answerable from a single file already in context.

# task tracking

Tasks tracked in Notion board "Envelope Tasks".

# tests are the norm

Every new feature gets a test; run `npm run typecheck && npm run lint && npm test`
before every commit. Jest (`jest-expo` preset) + React Native Testing Library,
config in `jest.config.js`/`jest.setup.js`. Tests are co-located as `*.test.ts(x)`
next to their source, matching `Web/`'s Vitest convention. CI runs `npm test` on
every push/PR via `.github/workflows/test.yml`.

Lessons from the Code Quality Checks pass (2026-08), worth not re-learning:

- One shared code path per concern (fetch, 401-handling, auth) — a second path that
  bypasses it (M3: streaming chat skipped the shared 401 handler) silently loses
  whatever the shared path was enforcing.
- Network calls need a timeout (M2) — RN `fetch` has no default; a hung request pins
  a loading state forever.
- Fail loud on missing config at startup (M4) — a silently-defaulted env var pointed
  a dev build at production data with no warning.
- Delete dead code, don't leave it commented as if live (M5) — it actively misleads
  the next reader into thinking a path still works.
- Clear all per-user local state on logout (M10), not just the obvious auth token —
  the next account on the device otherwise inherits the previous user's settings.
  Exception: preferences that belong to the _device_, not the account — the theme
  (`mc-theme-pref`) deliberately survives logout, because clearing it flipped a user
  who had picked Light on a dark-mode phone into dark mid-sign-out. Don't re-add a
  `subscribeLogout` to `ThemeProvider`.
- Ending the WorkOS session is the API's job, not the app's — revoke via
  `DELETE /api/user/sessions?id=` (`revokeSession()`), awaited _before_ `clearAccess()`
  while the bearer token is still live. `/user_management/sessions/logout` is a browser
  redirect endpoint; RN's fetch throws following the 302, so calling it reported every
  sign-out as a failure.

# success animation

App uses one shared success-tech animation (`src/components/shared/CheckIcon.tsx`: checkmark draw-on + haptic, swaps button label, background goes `tokens.mint`, auto-dismiss ~1100ms). Every synchronous success CTA (save/confirm button that resolves in-place) must reuse this pattern instead of a new toast/animation.

One exception: logging a _new_ expense earns its own moment across two screens.
The nav circle itself (`src/components/nav/AddCircleAnim.tsx`, wired into
`FloatingNav.tsx`'s add slot) plays a four-phase save animation in place of a
bare spinner — plus morphs away into a ripple + spinning ring while the request
is in flight (`AddCircleLoad`), then a halo + pop + `CheckIcon` draw on success
(`AddCircleDone`) — and `log-expense.tsx` only replaces the screen with
`app/modals/expense-added.tsx` ~950ms later, once that plays out.

`expense-added.tsx` is one tight column, no floating clusters: the tick
(a bundled Lottie clip, `assets/animations/success-tick.lottie`, played via
`lottie-react-native` — this screen's one departure from the app's drawn-icon
tick, since it earns its own moment), then "Added ₹X" on one line, then the
item name alone (category isn't repeated here — it's already on the budget
card below). The payoff is a budget card promoted right below it: a header
row (category dot + name, threshold-coloured "N% used" pill via
`ProgressBar.fillSoftColor`), then the "₹X left of ₹Y" line — `DeltaBar`
(`src/components/envelope/DeltaBar.tsx`) grows its base fill to the
*pre*-expense position, pins a ghost marker there, then snaps in a brighter
delta segment with a `+₹X` tag; "left" counts down from the pre-expense value
on the same beat (`DELTA_DELAY`), while "N% used" shows the final figure
immediately in the threshold colour (`ProgressBar.fillColor`). A days-left/pace
row ("N days left" / "₹X/day to stay on track") sits below a divider inside
the card, revealed last (`STAGGER.cardFooter`, 1.5s) — after the delta and its
tag have landed, as the final beat. Undo and Done sit side by side as
bordered/filled buttons; the timestamp is a
caption underneath. Editing an expense, and every other CTA, keeps the inline
pattern.

# voice and copy

The app is playful (Fredoka display font, Nunito body, `LoadingCaption.tsx`'s rotating
captions, Wrapped's persona cards), not corporate. Match that register in every string
a user reads: second person, sentence case, short.

- No em dashes in user-facing copy. They're the single most recognizable AI-generated
  tell, and a reader notices before they read a word. Split the sentence instead: two
  short sentences beat one long clause joined by a dash. Enforced by an eslint rule in
  `eslint.config.js`, so a stray em dash in a string fails `npm run lint`.
- Use contractions: "you're", "there's", "don't", "can't". Expanded forms ("you are not",
  "there is no", "you have assigned") are the second-loudest AI tell after the em dash, and
  every other screen already contracts, so a formal string sticks out. No lint rule catches
  this, so it's a review item.
- Never show raw server or exception text (`e.message`, `String(e)`) in an alert or
  inline error. "Failed to add expense: 503" gives the user nothing to act on. Write
  the message instead; match a known, already-written error case if there is one (see
  `app/(tabs)/envelopes.tsx`'s "already exists" check) and otherwise fall back to
  something generic like "Check your connection and try again."
- Reuse the app's existing typographic choices instead of improvising new ones: `·` as
  a separator (not `—` or `|`), the single `…` glyph for ellipsis (not three periods),
  and a standalone `—` only as the established placeholder glyph for a missing value
  (`EnvelopeRow.tsx`, `DatePicker.tsx`) rather than in a sentence.
