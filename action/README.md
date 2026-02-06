# ShipLint GitHub Action

🛡️ **Scan iOS projects for App Store Review Guideline issues in CI/CD**

ShipLint catches common App Store rejection reasons before you submit, saving days of review cycles.

## Quick Start

Add to your workflow (`.github/workflows/shiplint.yml`):

```yaml
name: ShipLint
on: [pull_request]

jobs:
  scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Signal26AI/ShipLint/action@v1
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

ShipLint creates inline annotations on your PR, showing exactly where issues are:

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
      
      - uses: Signal26AI/ShipLint/action@v1
        with:
          format: 'sarif'
          fail-on-error: 'false'
      
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: shiplint-results.sarif
```

## Available Rules

ShipLint checks for common rejection reasons:

| Rule ID | Description |
|---------|-------------|
| `privacy-001-missing-camera-purpose` | Camera usage without `NSCameraUsageDescription` |
| `privacy-002-missing-location-purpose` | Location usage without a purpose string |
| `privacy-003-att-tracking-mismatch` | Tracking SDKs without ATT / purpose string |
| `privacy-004-missing-photo-library-purpose` | Photo library usage without purpose string |
| `privacy-005-missing-microphone-purpose` | Microphone usage without purpose string |
| `privacy-006-missing-contacts-purpose` | Contacts usage without purpose string |
| `privacy-007-location-always-unjustified` | Always-on location without justification |
| `privacy-008-missing-bluetooth-purpose` | Bluetooth usage without purpose string |
| `privacy-009-missing-face-id-purpose` | Face ID usage without purpose string |
| `auth-001-third-party-login-no-siwa` | Third‑party login without Sign in with Apple |
| `metadata-001-missing-privacy-manifest` | Missing `PrivacyInfo.xcprivacy` when required |
| `metadata-002-missing-supported-orientations` | Missing supported orientations config |
| `config-001-ats-exception-without-justification` | ATS exceptions without justification |
| `config-002-missing-encryption-flag` | Missing export compliance encryption flag |
| `config-003-missing-launch-storyboard` | Missing launch storyboard config |

## Examples

### Scan specific path

```yaml
- uses: Signal26AI/ShipLint/action@v1
  with:
    path: 'ios/MyApp'
```

### Run specific rules only

```yaml
- uses: Signal26AI/ShipLint/action@v1
  with:
    rules: 'privacy-001-missing-camera-purpose,privacy-002-missing-location-purpose'
```

### Exclude rules

```yaml
- uses: Signal26AI/ShipLint/action@v1
  with:
    exclude: 'config-001-ats-exception-without-justification'
```

### Don't fail on issues (report only)

```yaml
- uses: Signal26AI/ShipLint/action@v1
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
      - uses: Signal26AI/ShipLint/action@v1
        with:
          path: ${{ matrix.project }}
```

## Why Use ShipLint?

App Store rejections cost time:
- 🕐 Average review time: 24-48 hours
- 🔄 Multiple rounds for common issues
- 😤 Frustrating for teams shipping fast

ShipLint catches issues **before** you submit:
- ✅ Privacy permission descriptions
- ✅ Sign in with Apple requirements  
- ✅ Privacy manifest compliance
- ✅ App Transport Security configuration

## License

MIT

## Contributing

Issues and PRs welcome at [ShipLint](https://github.com/Signal26AI/ShipLint)
