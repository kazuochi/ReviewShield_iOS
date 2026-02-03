# ReviewShield GitHub Action

🛡️ **Scan iOS projects for App Store Review Guideline issues in CI/CD**

ReviewShield catches common App Store rejection reasons before you submit, saving days of review cycles.

## Quick Start

Add to your workflow (`.github/workflows/reviewshield.yml`):

```yaml
name: ReviewShield
on: [pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: reviewshield/action@v1
        with:
          path: '.'
```

## Inputs

| Input | Description | Default |
|-------|-------------|---------|
| `path` | Path to scan (relative to repo root) | `.` |
| `format` | Output format: `text`, `json`, `sarif` | `text` |
| `fail-on-error` | Fail the action if issues found | `true` |
| `rules` | Comma-separated rule IDs to run (empty = all) | `` |
| `exclude` | Comma-separated rule IDs to exclude | `` |

## Outputs

| Output | Description |
|--------|-------------|
| `findings-count` | Number of issues found |
| `sarif-file` | Path to SARIF file (when format=sarif) |
| `exit-code` | 0 = clean, 1 = issues found |

## Features

### 📝 Inline Annotations

ReviewShield creates inline annotations on your PR, showing exactly where issues are:

- 🔴 **Error** - Critical/High severity (likely rejection)
- 🟡 **Warning** - Medium severity (may cause rejection)
- ℹ️ **Notice** - Low severity (best practice)

### 📊 Job Summary

Every run creates a summary table showing:
- Issue counts by severity
- List of all findings with locations
- Quick links to documentation

### 🔒 Security Tab Integration

Use SARIF output to see results in GitHub's Security tab:

```yaml
jobs:
  scan:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      
      - uses: reviewshield/action@v1
        with:
          format: 'sarif'
          fail-on-error: 'false'
      
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: reviewshield-results.sarif
```

## Available Rules

ReviewShield checks for common rejection reasons:

| Rule ID | Description |
|---------|-------------|
| `missing-camera-purpose` | Camera usage without NSCameraUsageDescription |
| `missing-location-purpose` | Location usage without purpose string |
| `location-always-unjustified` | Always-on location without justification |
| `att-tracking-mismatch` | ATT framework without NSUserTrackingUsageDescription |
| `third-party-login-no-siwa` | Third-party login without Sign in with Apple |
| `missing-privacy-manifest` | Missing PrivacyInfo.xcprivacy file |
| `ats-exception-without-justification` | ATS exceptions without justification |

## Examples

### Scan specific path

```yaml
- uses: reviewshield/action@v1
  with:
    path: 'ios/MyApp'
```

### Run specific rules only

```yaml
- uses: reviewshield/action@v1
  with:
    rules: 'missing-camera-purpose,missing-location-purpose'
```

### Exclude rules

```yaml
- uses: reviewshield/action@v1
  with:
    exclude: 'ats-exception-without-justification'
```

### Don't fail on issues (report only)

```yaml
- uses: reviewshield/action@v1
  with:
    fail-on-error: 'false'
```

### Monorepo with multiple projects

```yaml
jobs:
  scan:
    strategy:
      matrix:
        project: [apps/ios, apps/watchos]
    steps:
      - uses: actions/checkout@v4
      - uses: reviewshield/action@v1
        with:
          path: ${{ matrix.project }}
```

## Why Use ReviewShield?

App Store rejections cost time:
- 🕐 Average review time: 24-48 hours
- 🔄 Multiple rounds for common issues
- 😤 Frustrating for teams shipping fast

ReviewShield catches issues **before** you submit:
- ✅ Privacy permission descriptions
- ✅ Sign in with Apple requirements  
- ✅ Privacy manifest compliance
- ✅ App Transport Security configuration

## License

MIT

## Contributing

Issues and PRs welcome at [ReviewShield](https://github.com/reviewshield/reviewshield)
