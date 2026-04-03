# Paths Guard

A GitHub Action that re-checks workflow path filters at runtime. If the changed
files don't match the `paths` or `paths-ignore` configuration in your workflow
trigger, it cancels the workflow run.

## Why?

When GitHub experiences issues computing diffs, workflows with `paths` or
`paths-ignore` filters [run unconditionally][gh-docs]. This action acts as a
runtime safety net — it reads the path configuration directly from your workflow
file and re-validates it against the actual changed files.

Unlike [`dorny/paths-filter`][paths-filter], this action requires **zero
configuration duplication**. It reads the path patterns directly from your
workflow's trigger configuration.

[gh-docs]: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#running-your-workflow-based-on-files-changed-in-a-pull-request
[paths-filter]: https://github.com/dorny/paths-filter

## Usage

Add `paths-guard` as an early step in your workflow. It requires
`actions/checkout` to have run first (so it can read your workflow file).

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
        id: guard
      # Subsequent steps only run if paths matched
      - if: steps.guard.outputs.should_run == 'true'
        run: npm test
```

When the changed files don't match the path filters, `paths-guard` cancels the
workflow run and sets `should_run` to `false`. The workflow appears as
"cancelled" in the GitHub UI — a clear signal that the run was stopped because
it shouldn't have triggered.

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `token` | GitHub token with `actions: write` permission | `${{ github.token }}` |
| `workflow-file` | Explicit workflow file path (relative to repo root). Auto-detected if not set. | Auto-detected |
| `fallback` | Behavior when changed files can't be determined: `run` or `cancel` | `run` |

## Outputs

| Output | Description |
|--------|-------------|
| `should_run` | `true` if changed files match path filters, `false` otherwise |

## How It Works

1. Reads the executing workflow's YAML file from the checked-out repository
2. Parses the `paths` or `paths-ignore` configuration for the current event type
3. Queries the GitHub API for the list of changed files
4. Matches the changed files against the path patterns
5. If paths don't match: cancels the workflow run via the GitHub API

## Supported Events

- `push`
- `pull_request`
- `pull_request_target`

## Permissions

The action needs the `actions: write` permission to cancel workflow runs:

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
