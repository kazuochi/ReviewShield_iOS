# ReviewShield

🛡️ Catch App Store rejections before they happen.

ReviewShield scans your iOS project for App Store Review Guideline violations and tells you exactly how to fix them.

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

## Getting Started

**Coming soon:** ReviewShield GitHub App — automatic PR checks, no setup required.

Join the waitlist: [reviewshield.dev](https://reviewshield.dev)

## For Early Access

Contact us at hello@signal26.dev for beta access.

---

© 2026 Signal26. All rights reserved.
