@AGENTS.md

# graphify

Use the graphify skill whenever possible:
- Before answering any question about codebase, architecture, file relationships, or project content, query the graph first (`graphify query "<question>"`, `graphify path "A" "B"`, `graphify explain "<concept>"`) instead of grepping/reading files directly.
- After code changes, keep the graph fresh: run `/graphify --update` (or rely on the post-commit hook if installed).
- Use `.graphify/wiki/index.md` first when present; fall back to `.graphify/GRAPH_REPORT.md` only for broad reviews.
- If `.graphify/needs_update` exists or the graph is stale, warn and update before trusting semantic results.
- Only skip graphify when the question is trivially answerable from a single file already in context.

# task tracking

Tasks tracked in Notion board "Envelope".

# commit after task completion

Commit changes after completing a feature or fix.

# breaking long-running tasks

For any task expected to span multiple tool calls or involve 3+ files:
1. Create a todo list at the start (use Todowrite tool)
2. Mark items in_progress as you work them
3. Mark completed only after verified done (not just "written")
4. Keep exactly one in_progress at a time
5. If blocked, add follow-up todo describing the blocker

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

# success animation

App uses one shared success-tech animation (`src/components/shared/CheckIcon.tsx`: checkmark draw-on + haptic, swaps button label, background goes `tokens.mint`, auto-dismiss ~1100ms). Every synchronous success CTA (save/confirm button that resolves in-place) must reuse this pattern instead of a new toast/animation.

One exception: logging a *new* expense routes to the full success screen at
`app/modals/expense-added.tsx` — the app's primary verb, so it earns its own
moment. Two phases, no card or chip anywhere: the receipt lands first (200px
dotLottie tick badge + chime, then amount, `item · category`, timestamp), and
after `ENVELOPE_DELAY` the column glides up (`LinearTransition` on the group)
while the envelope block rises in below it — balance left, plus a `ProgressBar`
tweening from the pre-expense fill to the post-expense one. Editing an expense,
and every other CTA, keeps the inline pattern.
