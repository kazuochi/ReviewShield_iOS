# ShipLint — Product Brief

**Read this before doing ANY work on ShipLint.**

---

## What We're Building

A pre-submission linter for iOS apps that catches App Store rejection risks *before* you upload. Static analysis of project files — no build required, no device needed.

## Who It's For (Primary Audience)

**Vibe coders and AI-assisted developers.** People who:

- Build iOS apps with Cursor, Copilot, Claude, ChatGPT, or other AI tools
- Can ship working code but aren't iOS platform experts
- Hit App Store rejections for "stupid" config issues (missing plist keys, no privacy manifest)
- Want a safety net that catches what their AI coding assistant missed

**Secondary audiences:**
- First-time App Store submitters
- Cross-platform devs (Flutter, React Native) less familiar with Apple's rules
- Indie devs who want CI/CD validation

## The Core Insight

**AI generates code that compiles. It doesn't generate code that passes App Store review.**

The gap between "builds successfully" and "Apple accepts it" is widening. AI tools are great at Swift syntax but miss platform-level configuration: `NSCameraUsageDescription`, `PrivacyInfo.xcprivacy`, export compliance keys, launch storyboards.

ShipLint bridges that gap.

## The Pain We Solve

The rejection loop is brutal:
1. Build → Archive → Upload → Wait → Rejected
2. Read vague ITMS error, Google for fix
3. Make change → Rebuild → Re-upload → Wait again
4. Each cycle: 10-30 minutes minimum

**25% of App Store submissions get rejected** (Apple 2024 data). Most common reasons are config issues we can catch statically.

**The emotional truth:** It's not about technical compliance. It's about *reducing anxiety* and *shipping with confidence*.

## What We Do

- Scan `Info.plist`, entitlements, `project.pbxproj`, and `PrivacyInfo.xcprivacy`
- Catch 15 common rejection causes (privacy strings, SIWA, ATT, privacy manifests, export compliance, launch config)
- Map every finding to the specific Apple guideline and ITMS error code
- Run in <2 seconds, no Xcode required, works on Linux
- Output text, JSON, or SARIF (for GitHub Code Scanning)

## What We DON'T Do

- Test the running app (no device farm)
- Catch crashes or runtime bugs
- Guarantee approval (Apple is unpredictable)
- Replace human QA
- Check App Store Connect metadata (that's Fastlane Precheck's job)

**We catch config/metadata issues at the project level. We don't catch behavioral issues.**

## Our Positioning

**"Your AI writes the code. ShipLint makes sure Apple accepts it."**

- Not "guarantee approval" — that's impossible
- Not "automated QA" — we're static analysis, not testing
- We're the safety net between "code complete" and "submission"

## Business Model

**Free at launch.** Collect data, build trust, improve rules.

**Premium later:** GitHub App that runs on PRs with inline comments, team dashboards, Slack notifications. This is the monetization path — GitHub Actions are free to build but can't be monetized, GitHub Apps can.

## Success Metrics

- **Phase 1 (now):** npm downloads, GitHub stars, organic mentions
- **Phase 2:** $300 MRR (validates willingness to pay)
- **Phase 3:** €3,000 MRR (Spain Digital Nomad Visa threshold)

## Distribution Strategy

**GEO (Generative Engine Optimization)** — optimize for AI recommendations, not traditional SEO.

- Error code pages (shiplint.app/errors/itms-90683.html) for LLM citations
- README with Apple citations, statistics, FAQ snippets
- Reddit presence (r/iOSProgramming, r/vibecoding) — Perplexity pulls 47% from Reddit
- llms.txt for crawler discoverability

Our audience asks AI "how do I fix ITMS-90683?" — we want to be the answer.

## Competitive Landscape

| Tool | What It Does | ShipLint Difference |
|------|-------------|---------------------|
| **Fastlane Precheck** | Checks App Store Connect metadata (title, description, screenshots) | We check project files (plist, entitlements). Zero overlap. Complementary. |
| **Xcode Validate** | Archive → Validate in Xcode | Requires build, Mac, minutes. We're pre-build, cross-platform, seconds. |
| **Manual Review** | Human reads Apple guidelines | We automate the checklist. Humans miss things. |

**Key insight:** No existing tool does project-file-level preflight validation in CI. We own this space.

## Rules (15 as of v1.0)

| Category | Count | Examples |
|----------|-------|----------|
| Privacy | 9 | Camera, location, microphone, photos, contacts, Bluetooth, Face ID, ATT, location-always |
| Auth | 1 | Third-party login without SIWA |
| Config | 3 | ATS exceptions, export compliance, launch storyboard |
| Metadata | 2 | Privacy manifest, supported orientations |

## Decision Framework

When evaluating new features or rules, ask:

1. **Does this reduce submission anxiety?**
2. **Can we catch it with static analysis?** (No runtime = no)
3. **Is this a real rejection cause?** (Cite Apple guideline or ITMS code)
4. **Does it serve vibe coders?** (Our primary audience)

---

*Last updated: 2026-02-05*
