<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

# General Guidelines for working with Nx

- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- You have access to the Nx MCP server and its tools, use them to help the user
- When answering questions about the repository, use the `nx_workspace` tool first to gain an understanding of the workspace architecture where applicable.
- When working in individual projects, use the `nx_project_details` mcp tool to analyze and understand the specific project structure and dependencies
- For questions around nx configuration, best practices or if you're unsure, use the `nx_docs` tool to get relevant, up-to-date docs. Always use this instead of assuming things about nx configuration
- If the user needs help with an Nx configuration or project graph error, use the `nx_workspace` tool to get any errors
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.

<!-- nx configuration end-->

# Pettzi Project Guidelines

## Code and UX
- Keep UI aligned with the existing design system (Material icons, current color tokens, spacing, and typography).
- Prefer minimal UI changes; avoid introducing new patterns unless requested.
- Optional fields should not render placeholder/unknown text in cards or lists; hide the row if empty.
- When adding new event types or fields, update:
  - Create/edit forms
  - Dashboard activity log display
  - Event detail view
  - Pet record timeline
  - Translations (ES/EN)

## Data and API
- For new event fields, store both `title` and structured `metadata` when needed.
- Ensure backend handlers persist `title`/`notes` to DynamoDB.
- For reminders, keep message short and use `metadata.notes` for detailed info.

## Testing and quality
- Keep unit test coverage >= 80% for touched areas.
- Add/update tests for new event types and new rendering logic.
- Use `nx` for test/lint/build. Prefer `nx affected` when appropriate.

## Git and commits
- Use one commit per feature or fix.
- Do not combine unrelated changes in the same commit.
- Mention the area in commit messages (e.g., `feat(web): ...`, `fix(api-events): ...`).
