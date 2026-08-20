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

# success animation

App uses one shared success-tech animation (`src/components/shared/CheckIcon.tsx`: checkmark draw-on + haptic, swaps button label, background goes `tokens.mint`, auto-dismiss ~1100ms). Every synchronous success CTA (save/confirm button that resolves in-place) must reuse this pattern instead of a new toast/animation.
