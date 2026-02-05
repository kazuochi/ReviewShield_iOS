# ShipLint

🛡️ **Pre-submission linter for iOS apps.** Catches App Store rejection reasons before you upload.

[![CI](https://github.com/Signal26AI/ShipLint/actions/workflows/ci.yml/badge.svg)](https://github.com/Signal26AI/ShipLint/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/shiplint.svg)](https://www.npmjs.com/package/shiplint)

## What It Does

ShipLint scans your iOS project files — `Info.plist`, entitlements, `PrivacyInfo.xcprivacy`, and `project.pbxproj` — for issues that would trigger ITMS errors (ITMS-90683, ITMS-91053, ITMS-90078) or App Review violations. It runs in under 2 seconds, no Xcode required.

```bash
npx shiplint scan ./YourApp
```

**15 rules** covering privacy usage descriptions, App Tracking Transparency, Sign in with Apple, App Transport Security, privacy manifests, export compliance, and launch configuration. Maps each issue to the specific [Apple guideline](https://developer.apple.com/app-store/review/guidelines/) and ITMS error code.

## Documentation

📖 **Full documentation, rules reference, CI/CD setup, and FAQ:** [`typescript/README.md`](./typescript/README.md)

## Repository Structure

```
├── typescript/          # ShipLint CLI & scanning engine (npm package)
│   ├── src/
│   │   ├── rules/       # Rule definitions (privacy, auth, metadata, config)
│   │   ├── cli/         # CLI entry point
│   │   └── ...
│   ├── README.md        # ← Full documentation lives here
│   └── package.json
└── README.md            # This file (overview)
```

## Quick Links

- 🌐 [shiplint.app](https://shiplint.app)
- 📦 [npm: shiplint](https://www.npmjs.com/package/shiplint)
- 💻 [GitHub: Signal26AI/ShipLint](https://github.com/Signal26AI/ShipLint)
- 🐛 [Issues](https://github.com/Signal26AI/ShipLint/issues)

---

© 2025–2026 [Signal26](https://signal26.dev). All rights reserved.
