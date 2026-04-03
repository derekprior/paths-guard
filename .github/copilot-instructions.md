# Copilot Instructions for paths-guard

## Project Overview

This is a GitHub Action (TypeScript, compiled with `@vercel/ncc`) that re-checks
workflow path filters at runtime. It reads path configuration directly from the
executing workflow's YAML file — no config duplication required.

## Development Workflow

**Always use test-driven development (TDD):**

1. Write failing tests first
2. Run them to confirm they fail
3. Write the minimal implementation to make them pass
4. Run them to confirm they pass
5. Refactor if needed

**Never skip the red-green step.** Always run the tests after writing them to
see them fail before implementing.

## Commands

- `npm test` — run tests (vitest)
- `npm run test:watch` — run tests in watch mode
- `npm run typecheck` — type check without emitting
- `npm run build` — compile and bundle with ncc into `dist/`
- `npm run all` — typecheck + test + build

## Architecture

- `src/main.ts` — Action entry point. Orchestrates the workflow: read YAML →
  get changed files → match paths → set output / cancel.
- `src/path-matcher.ts` — Pure logic: glob-matches changed files against
  `paths` and `paths-ignore` patterns using picomatch.
- `src/workflow-parser.ts` — Parses workflow YAML and extracts path filters for
  a given event type.
- `src/changed-files.ts` — Gets changed files via GitHub API (primary) with
  local git diff fallback when the API fails.
- `src/git-diff.ts` — Local git operations: fetches the base commit and runs
  `git diff --name-only`.
- `src/index.ts` — Thin wrapper that calls `run()` from main.

## Testing

- Tests live in `__tests__/` with fixtures in `__tests__/fixtures/`.
- Use vitest. Tests use `vi.mock()` to mock dependencies.
- External dependencies (`@actions/core`, `@actions/github`, `fs`,
  `child_process`) must be mocked in tests — never make real API calls or
  filesystem operations outside of fixtures.
- Each source module has a corresponding test file.

## Key Design Decisions

- **API first, git fallback**: Changed file detection tries the GitHub API
  first (fast, cheap), then falls back to local `git diff` when the API fails.
  This is intentional — the action is a safety net for GitHub infrastructure
  issues, so the fallback must not depend on the same infrastructure.
- **Cancel is opt-in via input**: The `cancel` input (default `true`) controls
  whether the action cancels the workflow run or just sets the `should_run`
  output.
- **Zero config duplication**: The action reads path patterns from the workflow
  YAML itself. Users should never have to re-specify their path patterns.
- **SHA-256 support**: Null SHA detection uses a regex (`/^0+$/`) to support
  both SHA-1 and SHA-256 repositories.

## Building

The `dist/` directory is checked into the repository (required for GitHub
Actions). After any source changes, run `npm run build` and commit the updated
`dist/`.
