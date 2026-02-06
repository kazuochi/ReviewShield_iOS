# Changelog

All notable changes to ShipLint will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.1] - 2026-02-03

### Fixed

#### Bug #1: .xcodeproj path handling broken
- Scanner now correctly handles direct `.xcodeproj` or `.xcworkspace` paths passed as input
- Previously, passing `MyApp.xcodeproj` directly produced empty scans because discovery only searched for nested projects
- Fix: Detect when input path IS a `.xcodeproj` and use it directly

#### Bug #2: Silent rule filtering on typos
- Scanner now throws `InvalidRulesError` when `--rules` contains unknown rule IDs
- Previously, typos like `--rules privacy-001-tyop` silently returned "clean" results with no rules running
- Scanner now throws `NoRulesError` if all rules are excluded or no valid rules remain
- Added `getRulesWithValidation()` function that returns both found rules and unknown IDs

#### Bug #3: Shallow project discovery
- Project discovery now searches up to 5 directory levels deep (previously only 1)
- Monorepo structures like `packages/mobile/ios/MyApp.xcodeproj` now discovered
- Lockfile discovery (`Podfile.lock`, `Package.resolved`) is now recursive
- Discovery skips common non-project directories (`node_modules`, `.git`, `Pods`, `build`, `DerivedData`)
- Also searches inside `.xcodeproj` bundles for SPM Package.resolved

#### Bug #4: Swift CLI placeholder removed
- Removed Swift CLI (`Sources/`) which only printed "implementation in progress"
- Removed `Package.swift` and Swift `Tests/` directory
- ShipLint is now TypeScript-only as originally intended after pivot

### Changed
- `ScanOptions.format` and `ScanOptions.verbose` are now optional
- Added new error types: `InvalidRulesError`, `NoRulesError`

### Added
- Tests for xcodeproj path handling edge cases
- Tests for rule validation and error handling
- Tests for recursive lockfile discovery

## [0.2.0] - 2026-02-02

### Added

#### New Privacy Rules
- **privacy-004-missing-photo-library-purpose**: Detects usage of Photos/PhotosUI frameworks without NSPhotoLibraryUsageDescription. Also validates NSPhotoLibraryAddUsageDescription when present.
- **privacy-005-missing-microphone-purpose**: Detects usage of AVFAudio/Speech/AVFoundation frameworks without NSMicrophoneUsageDescription. Also checks NSSpeechRecognitionUsageDescription when Speech framework is used.
- **privacy-006-missing-contacts-purpose**: Detects usage of Contacts/ContactsUI frameworks without NSContactsUsageDescription.

#### New Metadata Rules
- **metadata-001-missing-privacy-manifest**: Checks for PrivacyInfo.xcprivacy when using SDKs known to require privacy manifests (Firebase, Facebook, Google Ads, analytics SDKs). iOS 17+ compliance for Required Reason APIs.

#### New Config Rules
- **config-001-ats-exception-without-justification**: Detects insecure App Transport Security configurations:
  - NSAllowsArbitraryLoads = true without NSExceptionDomains
  - NSAllowsArbitraryLoadsInWebContent = true
  - Redundant configurations with both global disable and exception domains
  - Missing NSExceptionMinimumTLSVersion on HTTP exception domains

### Changed
- Added new rule categories: `Metadata` and `Config`
- Updated rule registry to include all 10 rules

## [0.1.0] - 2026-02-02

### Added

#### Initial Release with 5 Rules
- **privacy-001-missing-camera-purpose**: Detects AVFoundation/AVKit/VisionKit usage without NSCameraUsageDescription
- **privacy-002-missing-location-purpose**: Detects CoreLocation/MapKit usage without location usage descriptions
- **privacy-003-location-always-unjustified**: Flags NSLocationAlwaysUsageDescription without background location modes
- **privacy-att-tracking-mismatch**: Detects ATT tracking SDKs without proper ATT framework and descriptions
- **auth-001-third-party-login-no-siwa**: Detects third-party social login SDKs without Sign in with Apple

#### Core Features
- Xcode project scanning with Info.plist and entitlements parsing
- CocoaPods and Swift Package Manager dependency detection
- Framework linking detection from project.pbxproj
- Multiple output formats: text, JSON, SARIF
- CLI interface with rule filtering and exclusion options
