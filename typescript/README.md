# ReviewShield

🛡️ Catch App Store rejections before they happen.

ReviewShield scans your iOS project for App Store Review Guideline violations and tells you exactly how to fix them.

## Installation

```bash
npm install -g reviewshield
```

Or with npx (no install required):

```bash
npx reviewshield scan ./MyApp.xcodeproj
```

## The Problem

App Store rejections cost time and money:
- 2-7 day review delays
- Missed launch windows
- Frustrated users waiting for updates

Common culprits: missing privacy descriptions, Sign in with Apple requirements, tracking compliance — all preventable.

## The Solution

ReviewShield catches these issues **before** you submit:

```bash
$ reviewshield scan ./MyApp.xcodeproj

🛡️  ReviewShield Scan Results

🔍 Found 2 issue(s):

1. [CRITICAL] Missing Camera Usage Description
   📍 Info.plist • 📋 Guideline 5.1.1
   
   Your app uses AVFoundation but Info.plist is missing 
   NSCameraUsageDescription...
   
   How to fix:
   Add NSCameraUsageDescription to your Info.plist...

2. [CRITICAL] Third-Party Login Without Sign in with Apple
   📍 Entitlements • 📋 Guideline 4.8
   
   Your app includes Google Sign-In but Sign in with Apple 
   is not configured...
```

## What We Check

| Category | Rules |
|----------|-------|
| **Privacy** | Camera, Location, Microphone, Photos, Contacts usage descriptions |
| **Tracking** | ATT compliance, tracking SDK detection |
| **Authentication** | Sign in with Apple requirements |
| **Security** | App Transport Security, Privacy Manifests (iOS 17+) |

10 rules today, more coming weekly.

## Usage

```bash
# Scan an Xcode project
reviewshield scan ./MyApp.xcodeproj

# Scan a directory
reviewshield scan ./ios

# Output as JSON
reviewshield scan ./MyApp.xcodeproj --format json
```

## Rules (10 and growing)

**Privacy (Guideline 5.1.1)**
- `missing-camera-purpose` - Camera usage without NSCameraUsageDescription
- `missing-microphone-purpose` - Microphone usage without NSMicrophoneUsageDescription  
- `missing-location-purpose` - Location usage without NSLocationUsageDescription
- `missing-photo-library-purpose` - Photo library usage without NSPhotoLibraryUsageDescription
- `missing-contacts-purpose` - Contacts usage without NSContactsUsageDescription
- `location-always-unjustified` - "Always" location without proper justification
- `att-tracking-mismatch` - ATT framework without NSUserTrackingUsageDescription

**Authentication (Guideline 4.8)**
- `third-party-login-no-siwa` - Third-party login without Sign in with Apple

**Security (Guideline 2.1)**
- `ats-exception-without-justification` - App Transport Security exceptions

**Metadata (iOS 17+)**
- `missing-privacy-manifest` - Missing PrivacyInfo.xcprivacy for required APIs

## Coming Soon

**ReviewShield GitHub App** — automatic PR checks, no setup required.

Join the waitlist: [reviewshield.dev](https://reviewshield.dev)

---

© 2026 Signal26. All rights reserved.
