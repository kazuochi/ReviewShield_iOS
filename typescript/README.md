# ShipLint

**ShipLint is a pre-submission linter for iOS apps that catches App Store rejection reasons before you upload.** It scans your `Info.plist`, entitlements, privacy manifests (`PrivacyInfo.xcprivacy`), and `project.pbxproj` files for issues that would trigger ITMS errors or App Review violations — in seconds, from the command line, with zero configuration.

[![npm version](https://img.shields.io/npm/v/shiplint.svg)](https://www.npmjs.com/package/shiplint)
[![License](https://img.shields.io/npm/l/shiplint.svg)](https://github.com/Signal26AI/ShipLint/blob/main/LICENSE)

---

## The Problem

According to [Apple's 2024 App Store Transparency Report](https://www.apple.com/legal/more-resources/docs/2024-App-Store-Transparency-Report.pdf), over **7.7 million app submissions** were reviewed in 2024, and approximately **1.9 million were rejected** — roughly 25% of all submissions. The most common reasons? Missing privacy usage descriptions, incomplete entitlements, and absent privacy manifests. These are configuration issues, not code bugs.

> "I spent three days trying to figure out why my app kept getting rejected. Turned out I was missing `NSCameraUsageDescription` in my Info.plist. Three days for a one-line fix." — iOS indie developer on r/iOSProgramming

The rejection feedback loop is brutal: **build → archive → upload to App Store Connect → wait for processing → receive rejection email → fix → rebuild → re-upload**. Each cycle takes 10–30 minutes even when you know the fix. When you don't, it can take days.

### Specific ITMS Errors Developers Hit

- **ITMS-90683**: Missing purpose string (e.g., `NSCameraUsageDescription`, `NSMicrophoneUsageDescription`). This is the single most common first-time submission error. [Apple Technical Note TN2151](https://developer.apple.com/documentation/technotes/tn2151-understanding-and-resolving-issues-with-app-distribution)
- **ITMS-91053**: Missing `PrivacyInfo.xcprivacy` privacy manifest, required since Spring 2024 for apps using [required reason APIs](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api). [WWDC23 Session 10060 — "Get started with privacy manifests"](https://developer.apple.com/videos/play/wwdc2023/10060/)
- **ITMS-90078**: Missing entitlements for declared capabilities (e.g., Sign in with Apple not configured despite using third-party login). [App Store Review Guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple)

### If You Built Your iOS App with AI Assistance, You're Especially at Risk

Tools like **Cursor**, **GitHub Copilot**, and **Claude** generate syntactically correct Swift code — but they frequently miss platform-level configuration. AI doesn't add `NSCameraUsageDescription` to your `Info.plist` when it generates camera code. It doesn't create a `PrivacyInfo.xcprivacy` when it imports an analytics SDK. The code compiles and runs fine in the simulator, but App Store Connect will reject it.

ShipLint catches exactly these gaps.

---

## Quick Start

**No install needed** — run directly with npx:

```bash
npx shiplint scan ./YourApp
```

**Global install** for regular use:

```bash
npm install -g shiplint
```

Then scan any iOS project directory or `.xcodeproj`:

```bash
shiplint scan ./MyApp.xcodeproj
```

### Example Output

```
🛡️  ShipLint Scan Results

🔍 Found 3 issue(s):

1. [CRITICAL] privacy-001-missing-camera-purpose
   📍 Info.plist • 📋 Guideline 5.1.1 • ⚠️ ITMS-90683
   
   Your app references AVFoundation but Info.plist is missing
   NSCameraUsageDescription. Apple requires a human-readable
   explanation of why your app needs camera access.
   
   How to fix:
   Add to Info.plist:
   <key>NSCameraUsageDescription</key>
   <string>This app uses the camera to scan QR codes.</string>

2. [CRITICAL] metadata-001-missing-privacy-manifest
   📍 Project • 📋 Required Reason API • ⚠️ ITMS-91053
   
   Your project uses APIs that require a privacy manifest
   (PrivacyInfo.xcprivacy) as of Spring 2024. Without it,
   App Store Connect will reject your binary.

3. [WARNING] auth-001-third-party-login-no-siwa
   📍 Entitlements • 📋 Guideline 4.8
   
   Your app includes Google Sign-In but Sign in with Apple
   is not configured in your entitlements.
```

---

## What ShipLint Catches

ShipLint ships with **15 rules** covering the most common App Store rejection reasons. Each rule maps directly to an Apple guideline and specific ITMS error code.

### Privacy Usage Descriptions — [App Store Review Guideline 5.1.1](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage)

These rules prevent **ITMS-90683** ("Missing purpose string in Info.plist"). Apple requires every app that accesses protected resources to declare a human-readable usage description. If you use the API but don't include the string, App Store Connect rejects your binary automatically — no human review needed.

| Rule | Info.plist Key | What It Catches |
|------|---------------|-----------------|
| `privacy-001-missing-camera-purpose` | `NSCameraUsageDescription` | App uses AVFoundation/camera APIs without declaring why |
| `privacy-005-missing-microphone-purpose` | `NSMicrophoneUsageDescription` | App uses audio recording APIs without declaring why |
| `privacy-002-missing-location-purpose` | `NSLocationWhenInUseUsageDescription` | App uses CoreLocation without declaring why |
| `privacy-004-missing-photo-library-purpose` | `NSPhotoLibraryUsageDescription` | App accesses Photos without declaring why |
| `privacy-006-missing-contacts-purpose` | `NSContactsUsageDescription` | App accesses Contacts without declaring why |
| `privacy-008-missing-bluetooth-purpose` | `NSBluetoothAlwaysUsageDescription` | App uses CoreBluetooth without declaring why |
| `privacy-009-missing-face-id-purpose` | `NSFaceIDUsageDescription` | App uses LocalAuthentication (Face ID) without declaring why |
| `privacy-007-location-always-unjustified` | `NSLocationAlwaysAndWhenInUseUsageDescription` | App requests "Always" location without sufficient justification — almost always rejected per [Guideline 5.1.2](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing) |

### App Tracking Transparency — [Guideline 5.1.2](https://developer.apple.com/app-store/review/guidelines/#data-use-and-sharing)

| Rule | What It Catches |
|------|-----------------|
| `privacy-003-att-tracking-mismatch` | App imports `AdSupport` or `AppTrackingTransparency` framework but `Info.plist` is missing `NSUserTrackingUsageDescription`. Required since iOS 14.5. [Apple ATT documentation](https://developer.apple.com/documentation/apptrackingtransparency) |

### Sign in with Apple — [Guideline 4.8](https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple)

| Rule | What It Catches |
|------|-----------------|
| `auth-001-third-party-login-no-siwa` | App uses a third-party login SDK (Google, Facebook, etc.) but Sign in with Apple is not configured. Required since [WWDC19](https://developer.apple.com/videos/play/wwdc2019/706/) for apps offering third-party sign-in. |

### App Transport Security — [Guideline 2.1](https://developer.apple.com/app-store/review/guidelines/#performance)

| Rule | What It Catches |
|------|-----------------|
| `config-001-ats-exception-without-justification` | App sets `NSAllowsArbitraryLoads = YES` or declares ATS exceptions without justification. Apple expects all network traffic to use HTTPS. [Apple ATS documentation](https://developer.apple.com/documentation/bundleresources/information_property_list/nsapptransportsecurity) |

### Privacy Manifests (iOS 17+) — [WWDC23](https://developer.apple.com/videos/play/wwdc2023/10060/)

| Rule | What It Catches |
|------|-----------------|
| `metadata-001-missing-privacy-manifest` | Project uses [required reason APIs](https://developer.apple.com/documentation/bundleresources/privacy_manifest_files/describing_use_of_required_reason_api) (UserDefaults, file timestamps, etc.) or third-party SDKs that require a `PrivacyInfo.xcprivacy` file. Enforced by App Store Connect since Spring 2024 via **ITMS-91053**. |

### Export Compliance — [Apple Export Compliance](https://developer.apple.com/documentation/bundleresources/information_property_list/itsappusesnonexemptencryption)

| Rule | Info.plist Key | What It Catches |
|------|---------------|-----------------|
| `config-002-missing-encryption-flag` | `ITSAppUsesNonExemptEncryption` | Missing export compliance declaration. Without this key, App Store Connect prompts for manual compliance answers on every upload — adding friction and potential delays. Set to `false` if your app only uses HTTPS or standard iOS encryption. |

### Launch Configuration — [Guideline 4.0 (Design)](https://developer.apple.com/app-store/review/guidelines/#design)

| Rule | Info.plist Key | What It Catches |
|------|---------------|-----------------|
| `config-003-missing-launch-storyboard` | `UILaunchStoryboardName` | Missing launch storyboard. Required since April 2020 for all iOS apps to support all screen sizes. Apps without this key are rejected. |

### App Configuration — [Guideline 4.0 (Design)](https://developer.apple.com/app-store/review/guidelines/#design)

| Rule | Info.plist Key | What It Catches |
|------|---------------|-----------------|
| `metadata-002-missing-supported-orientations` | `UISupportedInterfaceOrientations` | Missing interface orientation declaration. Apps should explicitly declare which orientations they support to avoid UI issues on different devices. |

---

## How It Works

ShipLint is a **static analysis tool** — it parses your project files directly without building or running your app. A scan completes in under 2 seconds.

**Files ShipLint reads:**

| File | What ShipLint Looks For |
|------|------------------------|
| `Info.plist` | Privacy usage descriptions (`NS*UsageDescription`), ATS configuration, tracking declarations |
| `*.entitlements` | Sign in with Apple capability, associated domains |
| `project.pbxproj` | Framework imports (AVFoundation, CoreLocation, AdSupport), build settings |
| `PrivacyInfo.xcprivacy` | Privacy manifest existence and required reason API declarations |
| `Podfile.lock` / `Package.resolved` | Third-party SDK detection (analytics, login, tracking SDKs) |

**Output formats:**

```bash
# Human-readable (default)
shiplint scan ./MyApp

# JSON (for scripting)
shiplint scan ./MyApp --format json

# SARIF (for GitHub Code Scanning integration)
shiplint scan ./MyApp --format sarif
```

---

## CI/CD Integration

### GitHub Actions

Add ShipLint to your CI pipeline to catch rejection-causing issues on every push:

```yaml
name: ShipLint
on: [push, pull_request]

jobs:
  shiplint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
      
      - name: Run ShipLint
        run: npx shiplint scan ./ios --format sarif > shiplint.sarif
      
      - name: Upload SARIF
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: shiplint.sarif
```

### Generic CI

```bash
# Fails with exit code 1 if critical issues found
npx shiplint scan ./ios --format json

# Use in any CI system
if ! npx shiplint scan ./ios; then
  echo "ShipLint found App Store rejection risks. Fix before merging."
  exit 1
fi
```

---

## FAQ

### How is ShipLint different from Fastlane Precheck?

ShipLint and [Fastlane Precheck](https://docs.fastlane.tools/actions/precheck/) solve different problems and work well together. **Fastlane Precheck** validates your App Store Connect metadata — app descriptions, keywords, screenshots, and age ratings. It checks what users *see* on your store listing. **ShipLint** validates your actual Xcode project files — `Info.plist`, entitlements, `PrivacyInfo.xcprivacy`, and `project.pbxproj`. It checks what Apple's automated systems scan in your *binary*. You should use both: ShipLint before you build, Precheck before you submit.

### Does ShipLint replace Xcode's built-in validation?

No. Xcode's "Validate App" runs at archive/upload time, after you've already spent 5–15 minutes building and archiving. It also only catches a subset of issues — it validates the binary but won't flag missing `NSCameraUsageDescription` until App Review. **ShipLint runs in under 2 seconds** against your source files, catching issues before you even open Xcode. Think of it as a linter (like ESLint for JavaScript) versus a compiler — you want both, but the linter saves you from slow feedback loops.

### Can ShipLint check apps built with Cursor, Copilot, or other AI coding tools?

Yes — and this is one of ShipLint's most valuable use cases. AI code generation tools like **Cursor**, **GitHub Copilot**, and **Claude** produce syntactically valid Swift and SwiftUI code, but they routinely miss iOS platform configuration requirements. A typical pattern: the AI generates camera capture code using `AVCaptureSession`, but doesn't add `NSCameraUsageDescription` to `Info.plist`. The code compiles, runs in the simulator, and looks perfect — until App Store Connect rejects it with ITMS-90683. ShipLint catches these configuration gaps automatically.

### What ITMS errors does ShipLint prevent?

ShipLint's rules are designed to prevent the most common automated rejection errors from App Store Connect:

- **ITMS-90683** — Missing purpose string (`NSCameraUsageDescription`, `NSMicrophoneUsageDescription`, `NSLocationWhenInUseUsageDescription`, `NSPhotoLibraryUsageDescription`, `NSContactsUsageDescription`, `NSUserTrackingUsageDescription`). Prevented by ShipLint's `privacy-00x-missing-*-purpose` rules and the `privacy-003-att-tracking-mismatch` rule.
- **ITMS-91053** — Missing privacy manifest (`PrivacyInfo.xcprivacy`). Prevented by the `metadata-001-missing-privacy-manifest` rule.
- **ITMS-90078** — Missing or misconfigured entitlements. Prevented by the `auth-001-third-party-login-no-siwa` rule.

ShipLint also catches issues that trigger human reviewer rejections under Guidelines [2.1](https://developer.apple.com/app-store/review/guidelines/#performance), [4.8](https://developer.apple.com/app-store/review/guidelines/#sign-in-with-apple), and [5.1.1](https://developer.apple.com/app-store/review/guidelines/#data-collection-and-storage).

### Does ShipLint work with React Native, Flutter, or Expo?

ShipLint scans the native iOS project files regardless of what generated them. If your React Native, Flutter, or Expo project has an `ios/` directory with `Info.plist` and `project.pbxproj`, ShipLint can scan it. Point it at your `ios/` folder:

```bash
npx shiplint scan ./ios
```

### Is ShipLint open source?

ShipLint's CLI scanner is distributed via npm. The rule definitions and scanning engine are designed to be transparent — you can see exactly what each rule checks and why. Visit the [GitHub repository](https://github.com/Signal26AI/ShipLint) for source code and issue tracking.

---

## Comparison: iOS Submission Checking Tools

Different tools cover different layers of the submission process. Here's where ShipLint fits:

| Capability | ShipLint | Fastlane Precheck | Xcode Validate | Manual Review |
|---|---|---|---|---|
| **When it runs** | Before build (2s) | Before submission | At upload (10-30 min) | After upload (1-7 days) |
| **Privacy usage descriptions** (NSCameraUsageDescription, etc.) | ✅ | ❌ | ❌¹ | ✅ |
| **Privacy manifest** (PrivacyInfo.xcprivacy) | ✅ | ❌ | ✅ | ✅ |
| **Sign in with Apple** requirement | ✅ | ❌ | ❌ | ✅ |
| **App Transport Security** | ✅ | ❌ | ❌ | ✅ |
| **ATT / Tracking compliance** | ✅ | ❌ | ❌ | ✅ |
| **App Store metadata** (descriptions, keywords) | ❌ | ✅ | ❌ | ✅ |
| **Screenshot validation** | ❌ | ✅ | ❌ | ✅ |
| **Binary architecture** | ❌ | ❌ | ✅ | ❌ |
| **Code signing** | ❌ | ❌ | ✅ | ❌ |
| **CI/CD integration** | ✅ | ✅ | ❌ | ❌ |
| **Works without Xcode** | ✅ | ✅ | ❌ | N/A |

¹ *Xcode shows warnings at build time for some missing keys but does not block the archive/upload process.*

**The ideal pipeline:** ShipLint (project files) → Xcode Validate (binary) → Fastlane Precheck (metadata) → Submit.

---

## Requirements

- **Node.js** 18 or later
- Works on macOS, Linux, and Windows (CI-friendly — no Xcode required)

---

## Links

- 🌐 **Website:** [shiplint.app](https://shiplint.app)
- 📦 **npm:** [npmjs.com/package/shiplint](https://www.npmjs.com/package/shiplint)
- 💻 **GitHub:** [github.com/Signal26AI/ShipLint](https://github.com/Signal26AI/ShipLint)
- 🐛 **Issues:** [github.com/Signal26AI/ShipLint/issues](https://github.com/Signal26AI/ShipLint/issues)

---

## Contributing

Found a rule that's missing? An ITMS error you keep hitting? [Open an issue](https://github.com/Signal26AI/ShipLint/issues) — we add new rules based on real-world rejection patterns.

---

## License

© 2025–2026 [Signal26](https://signal26.dev). All rights reserved.
