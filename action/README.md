# ShipLint GitHub Action

🛡️ **Scan iOS projects for App Store Review Guideline issues on every pull request.**

ShipLint catches common App Store rejection reasons before you submit — saving days of review cycles. The GitHub Action runs automatically on PRs that touch iOS project files, posts a formatted comment with results, and fails the check on critical issues.

## Quick Start

Add to `.github/workflows/shiplint.yml`:

```yaml
name: ShipLint
on:
  pull_request:
    paths: ['**/*.swift', '**/*.plist', '**/*.pbxproj', '**/*.entitlements']

permissions:
  contents: read
  pull-requests: write

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Signal26AI/ShipLint/action@v1
        with:
          severity-threshold: 'critical'
          comment: 'true'
```

That's it. ShipLint auto-detects your Xcode project and scans it.

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `path` | Path to scan (relative to repo root) | Auto-detect |
| `project-path` | Explicit `.xcodeproj` / `.xcworkspace` path | Auto-detect |
| `severity-threshold` | Minimum severity to fail: `critical`, `high`, `medium`, `low`, `info` | `critical` |
| `comment` | Post scan results as a PR comment | `true` |
| `format` | Output format: `text`, `json`, `sarif` | `text` |
| `fail-on-error` | Fail the check when issues meet the threshold | `true` |
| `rules` | Comma-separated rule IDs to run (empty = all) | All |
| `exclude` | Comma-separated rule IDs to exclude | None |
| `github-token` | Token for PR comments | `${{ github.token }}` |

## Outputs

| Output | Description |
|--------|-------------|
| `findings-count` | Number of issues found |
| `sarif-file` | Path to SARIF file (when `format=sarif`) |
| `exit-code` | `0` = clean, `1` = issues found |

## How It Works

1. **Auto-detects** your `.xcworkspace` or `.xcodeproj` (or use `project-path`)
2. **Runs `shiplint scan`** against the project
3. **Creates GitHub annotations** — inline warnings/errors on the PR diff
4. **Posts a PR comment** with a summary table and per-finding details
5. **Sets check status** — fails if issues meet your `severity-threshold`

### Severity Behavior

| Threshold | Fails on | Passes with warnings |
|-----------|----------|---------------------|
| `critical` (default) | 🔴 Critical | 🟠🟡🟢 High, Medium, Low |
| `high` | 🔴🟠 Critical, High | 🟡🟢 Medium, Low |
| `medium` | 🔴🟠🟡 Critical, High, Medium | 🟢 Low |
| `low` | All issues | — |

## PR Comment

When `comment: true`, ShipLint posts (or updates) a single comment on the PR:

- ✅ **All Clear** when no issues found
- ❌ **Issues Found** with severity breakdown table
- Per-finding details with rule ID, description, and fix guidance
- Collapsible details when >5 findings

The comment is updated on each push — no duplicate comments.

## Examples

### Only scan on iOS file changes

```yaml
on:
  pull_request:
    paths:
      - '**/*.swift'
      - '**/*.m'
      - '**/*.plist'
      - '**/*.pbxproj'
      - '**/*.entitlements'
```

### Strict mode — fail on medium+

```yaml
- uses: Signal26AI/ShipLint/action@v1
  with:
    severity-threshold: 'medium'
```

### Monorepo — scan specific project

```yaml
- uses: Signal26AI/ShipLint/action@v1
  with:
    project-path: 'apps/iOS/MyApp.xcodeproj'
```

### SARIF for GitHub Security tab

```yaml
- uses: Signal26AI/ShipLint/action@v1
  id: shiplint
  with:
    format: 'sarif'

- uses: github/codeql-action/upload-sarif@v3
  if: always()
  with:
    sarif_file: shiplint-results.sarif
```

### Custom rules

```yaml
- uses: Signal26AI/ShipLint/action@v1
  with:
    rules: 'privacy-001-missing-camera-purpose,privacy-002-missing-location-purpose'
```

## Permissions

The action needs `pull-requests: write` to post comments. If you don't want comments, set `comment: false` and you only need `contents: read`.

## License

MIT
