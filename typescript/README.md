# ReviewShield

🛡️ App Store Review Guideline scanner for iOS projects

ReviewShield statically analyzes your Xcode project to detect potential App Store Review issues before you submit.

## Features

- **5 MVP Rules** covering common rejection reasons:
  - Missing camera usage description
  - Missing location usage descriptions
  - Unjustified Always location permission
  - Tracking SDKs without App Tracking Transparency
  - Third-party login without Sign in with Apple

- **Multiple output formats**: Text (human-readable), JSON, SARIF (for CI/CD)
- **ESLint-style plugin architecture** for easy rule extension
- **Zero configuration** - just point to your project

## Installation

```bash
npm install -g reviewshield
```

Or use directly with npx:

```bash
npx reviewshield scan /path/to/project
```

## Usage

### Basic Scan

```bash
reviewshield scan /path/to/MyApp.xcodeproj
```

### Output Formats

```bash
# Human-readable text (default)
reviewshield scan /path/to/project

# JSON for scripting
reviewshield scan /path/to/project --format json

# SARIF for CI/CD (GitHub, Azure DevOps)
reviewshield scan /path/to/project --format sarif
```

### List Available Rules

```bash
reviewshield rules
```

### Run Specific Rules Only

```bash
reviewshield scan /path/to/project --rules privacy-001-missing-camera-purpose privacy-002-missing-location-purpose
```

### Exclude Rules

```bash
reviewshield scan /path/to/project --exclude auth-001-third-party-login-no-siwa
```

## Rules

| ID | Name | Guideline | Severity |
|----|------|-----------|----------|
| `privacy-001-missing-camera-purpose` | Missing Camera Usage Description | 5.1.1 | Critical |
| `privacy-002-missing-location-purpose` | Missing Location Usage Description | 5.1.1 | Critical |
| `entitlements-001-location-always-unjustified` | Location Always Without Justification | 5.1.1 | Critical |
| `privacy-003-att-tracking-mismatch` | Tracking SDK Without ATT | 5.1.2 | Critical |
| `auth-001-third-party-login-no-siwa` | Third-Party Login Without SIWA | 4.8 | Critical |

## Programmatic Usage

```typescript
import { scan, OutputFormat } from 'reviewshield';

const result = await scan({
  path: '/path/to/project',
  format: OutputFormat.JSON,
  verbose: false,
});

console.log(`Found ${result.findings.length} issues`);

for (const finding of result.findings) {
  console.log(`[${finding.severity}] ${finding.title}`);
  console.log(`  ${finding.description}`);
}
```

## CI/CD Integration

### GitHub Actions

```yaml
name: App Store Review Check

on: [push, pull_request]

jobs:
  reviewshield:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install ReviewShield
        run: npm install -g reviewshield
      
      - name: Run ReviewShield
        run: reviewshield scan . --format sarif > reviewshield.sarif
      
      - name: Upload SARIF
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: reviewshield.sarif
```

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run in development mode
npm run dev -- scan /path/to/project
```

## License

MIT
