# Paths Guard

A GitHub Action that re-checks workflow path filters at runtime. If the changed
files don't match the `paths` or `paths-ignore` configuration in your workflow
trigger, it cancels the workflow run.

## Why?

When GitHub experiences issues computing diffs, workflows with `paths` or
`paths-ignore` filters [run unconditionally][gh-docs]. This action acts as a
runtime safety net — it reads the path configuration directly from your workflow
file and re-validates it against the actual changed files.

This action requires **zero configuration duplication** — it reads the path
patterns directly from your workflow's trigger configuration.

[gh-docs]: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#running-your-workflow-based-on-files-changed-in-a-pull-request

## Usage

Add `paths-guard` as an early step in your workflow. It requires
`actions/checkout` to have run first (so it can read your workflow file).

### Cancel the workflow (default)

By default, when the changed files don't match the path filters, `paths-guard`
cancels the workflow run via the GitHub API. The workflow appears as "cancelled"
in the UI — a clear signal that the run was stopped because it shouldn't have
triggered.

```yaml
name: CI
on:
  push:
    paths:
      - "src/**"
      - "package.json"

permissions:
  actions: write

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: derekprior/paths-guard@v1
      - run: npm test
```

### Control downstream jobs with `cancel: false`

Set `cancel: false` to skip cancellation and instead use the `should_run` output
to gate downstream jobs. This is useful when you want skipped jobs to appear as
neutral/skipped rather than cancelled, or when you need to run cleanup steps
regardless of the path match result.

```yaml
name: CI
on:
  push:
    paths:
      - "src/**"
      - "package.json"

permissions:
  actions: write

jobs:
  guard:
    runs-on: ubuntu-latest
    outputs:
      should_run: ${{ steps.check.outputs.should_run }}
    steps:
      - uses: actions/checkout@v4
      - uses: derekprior/paths-guard@v1
        id: check
        with:
          cancel: false

  build:
    needs: guard
    if: needs.guard.outputs.should_run == 'true'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm test

  deploy:
    needs: [guard, build]
    if: needs.guard.outputs.should_run == 'true'
    runs-on: ubuntu-latest
    steps:
      - run: echo "Deploying..."
```

When `build` and `deploy` are skipped because of the `if:` condition, they
appear as skipped (neutral) in the GitHub UI. If they are required status checks,
GitHub treats skipped checks as passing by default.

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `token` | GitHub token used to query changed files and cancel the workflow run. Requires `actions: write` permission to cancel. | Yes | `${{ github.token }}` |
| `workflow-file` | Explicit path to the workflow file (relative to repo root). If not set, automatically resolved from `GITHUB_WORKFLOW_REF`. | No | Auto-detected |
| `cancel` | Whether to cancel the workflow run when path filters don't match. Set to `false` to only set the `should_run` output without cancelling. Useful for job-level gating or integration testing. | No | `true` |
| `fallback` | Behavior when changed files cannot be determined (e.g., API failure). `run` allows the workflow to continue. `cancel` cancels the workflow run (respects the `cancel` input). | No | `run` |

## Outputs

| Output | Description |
|--------|-------------|
| `should_run` | `true` if the changed files match the workflow's path filters, `false` otherwise. Always set regardless of the `cancel` input. |

## How It Works

1. Reads the executing workflow's YAML file from the checked-out repository
2. Parses the `paths` or `paths-ignore` configuration for the current event type
3. Gets the list of changed files (see below)
4. Matches the changed files against the path patterns
5. Sets the `should_run` output
6. If paths don't match and `cancel` is `true`: cancels the workflow run via the
   GitHub API

### Changed file detection

The action uses a two-tier strategy to determine which files changed:

1. **GitHub API (primary)**: Queries the compare API (for pushes) or the pull
   request files API (for PRs). This is fast and lightweight — no extra git
   operations needed.

2. **Local git diff (fallback)**: If the API call fails, the action falls back
   to computing the diff locally. It fetches the base commit with
   `git fetch --depth=1` and runs `git diff --name-only` to determine changed
   files. This is resilient even when GitHub's API is degraded — which is
   exactly the scenario this action is designed to handle.

**Trade-offs**: The git fallback fetches one additional commit and its tree
from the remote. For very large, active repositories this could add meaningful
overhead. In practice, the fallback only runs when the API is unavailable, which
should be rare — the API handles the 99.99% common case cheaply.

## Supported Events

- `push`
- `pull_request`
- `pull_request_target`

## Permissions

The action needs the `actions: write` permission to cancel workflow runs. If you
use `cancel: false`, no special permissions are needed beyond the default token
scope.

```yaml
permissions:
  actions: write
```

## Development

```bash
npm install
npm test        # run tests
npm run build   # compile and bundle with ncc
npm run all     # typecheck + test + build
```

## License

MIT
