# ShipLint Reddit Drafts

## Post 1: r/iOSProgramming

### Title
**Common ITMS errors and how to catch them before submission**

### Body

After 6+ years of shipping iOS apps, I've spent way too many hours staring at cryptic ITMS errors in App Store Connect. The worst part? Most rejections are for config issues that could've been caught in 30 seconds.

I finally documented the ones that bite most often. Maybe this saves someone a 24-hour review cycle.

---

**ITMS-90683: Missing Purpose String**

Your app uses a protected resource (camera, location, photos) but doesn't explain *why* in Info.plist. Apple requires user-facing descriptions for privacy.

The fix: Add the appropriate `NS*UsageDescription` key. For camera, that's `NSCameraUsageDescription` with a string like "Used to scan documents."

Detailed breakdown: [shiplint.app/errors/itms-90683.html](https://shiplint.app/errors/itms-90683.html)

---

**ITMS-91053: Missing Privacy Manifest**

Starting in Spring 2024, Apple requires a `PrivacyInfo.xcprivacy` file if you use certain APIs (UserDefaults timestamps, file timestamps, etc.). This one catches a LOT of people off guard because your app works perfectly — until Apple rejects it.

The fix: Add a privacy manifest declaring which "required reason APIs" you use and why.

Detailed breakdown: [shiplint.app/errors/itms-91053.html](https://shiplint.app/errors/itms-91053.html)

---

**ITMS-90078: Missing App Icon**

Sounds obvious, but this trips up automated builds and CI pipelines constantly. You need a 1024x1024 App Store icon in your asset catalog — the regular app icons aren't enough.

The fix: Add `AppIcon` to Assets.xcassets with the marketing icon slot filled.

Detailed breakdown: [shiplint.app/errors/itms-90078.html](https://shiplint.app/errors/itms-90078.html)

---

**Catching these early**

I got tired of manually checking for this stuff, so I built a CLI scanner called [ShipLint](https://shiplint.app) that catches these before you submit. It's just `npx shiplint scan ./YourApp.xcodeproj` — takes about 10 seconds and flags anything that'll get rejected.

But even without tools, the main thing is: **check your Info.plist privacy keys, verify your privacy manifest exists, and confirm your asset catalog has the marketing icon.** Do that before every submission and you'll avoid 80% of ITMS errors.

What errors have burned you the most? Curious if there are patterns I missed.

---

## Post 2: r/vibecoding

### Title
**Built an iOS app with AI? Here's what to check before submitting to Apple**

### Body

I've been using Claude/GPT to build iOS apps and honestly it's incredible for the actual code. But I've noticed a pattern: AI-generated apps compile and run great... then get rejected by Apple.

The issue isn't the code logic — it's platform-specific config that AI doesn't always include. Here's what to check before you submit:

---

**1. Privacy Usage Descriptions**

If your app uses camera, microphone, location, or photos, you need to explain *why* in `Info.plist`. AI often imports the framework but forgets the usage string.

Check for these keys:
- `NSCameraUsageDescription`
- `NSMicrophoneUsageDescription`
- `NSLocationWhenInUseUsageDescription`
- `NSPhotoLibraryUsageDescription`

Each needs a human-readable explanation like "Used to take profile photos."

---

**2. Privacy Manifest (new in 2024)**

Apple now requires a `PrivacyInfo.xcprivacy` file if you use certain APIs. The tricky part: things like `UserDefaults` and `Date()` can trigger this requirement, and AI uses these constantly.

If you get ITMS-91053, this is why.

---

**3. App Store Icon**

Your asset catalog needs a 1024x1024 "App Store" icon — not just the app icons. AI-generated projects sometimes skip this, especially if you started from a minimal template.

---

**The safety net I use**

I run `npx shiplint scan ./MyApp` before every submission now. It's a CLI tool that checks for all the config stuff Apple will reject you for — takes 10 seconds and has saved me multiple review cycles.

Not affiliated, just genuinely useful for the vibe coding workflow where you're moving fast and might miss config details.

---

**The bigger point**

AI is great at writing Swift that compiles. It's not great at knowing Apple's submission requirements. Think of preflight checks as the bridge between "it works on my machine" and "it's in the App Store."

Anyone else hit weird rejections with AI-built apps? Would love to hear what tripped you up.

---

## Posting Strategy

### Best Times to Post
- **r/iOSProgramming**: Tuesday-Thursday, 9-11 AM EST (catches US devs starting their day)
- **r/vibecoding**: Monday-Wednesday, 10 AM - 12 PM EST (vibe coders tend to be early adopters, weekday mornings work well)

### Alternative Subreddits

If primary subs don't allow tool mentions or posts get removed:

| Primary | Alternatives |
|---------|-------------|
| r/iOSProgramming | r/iOSdev, r/swift, r/SwiftUI, r/XcodeGeneral |
| r/vibecoding | r/ChatGPTCoding, r/LocalLLaMA (for self-hosted crowd), r/SideProject |

### Reddit Self-Promotion Rules to Follow

1. **10% rule**: No more than 10% of your posts/comments should be self-promotional. Build karma with genuine contributions first.

2. **Value-first framing**: The post educates regardless of whether anyone clicks. The tool mention is secondary.

3. **Disclose naturally**: "I built a tool" is honest. Don't pretend to be a random user who "discovered" it.

4. **Engage in comments**: Reply to questions, provide additional help. Don't just post and ghost.

5. **No URL shorteners**: Use full URLs. Reddit spam filters hate shorteners.

6. **Read each sub's rules**: Some subs (like r/swift) have specific "Self-Promotion Saturday" threads. Use those if they exist.

7. **Account age matters**: If your account is new, build some karma through helpful comments before posting links.

### Adaptation Notes

- **If vibecoding doesn't exist**: r/ChatGPTCoding is the backup. Same post works with minor tone adjustment.
- **For r/swift specifically**: Focus more on the technical details, less on the "vibe coding" angle. That audience is more traditional.
- **For r/SideProject**: Can be more openly promotional — that sub expects it. Lead with "I built this to solve my own problem."
