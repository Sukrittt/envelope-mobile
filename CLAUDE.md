@AGENTS.md

# graphify

If `.graphify/` present in codebase, use graphify skill for questions about codebase, project content, architecture, or file relationships.

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
