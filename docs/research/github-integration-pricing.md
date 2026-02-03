# GitHub Integration & Pricing Research for ShipLint

*Research conducted: February 2026*

---

## Table of Contents
1. [GitHub Actions Integration Patterns](#1-github-actions-integration-patterns)
2. [GitHub App vs GitHub Action](#2-github-app-vs-github-action)
3. [Pricing Models for Dev Tools](#3-pricing-models-for-dev-tools)
4. [Adoption & Growth Patterns](#4-adoption--growth-patterns)
5. [iOS-Specific Considerations](#5-ios-specific-considerations)
6. [Recommendations for ShipLint](#6-recommendations-for-shiplint)

---

## 1. GitHub Actions Integration Patterns

### How Popular Linters Integrate

#### SwiftLint (iOS-focused)
Multiple GitHub Actions available in the marketplace:
- **norio-nomura/action-swiftlint** - Most popular, runs on Ubuntu
- **sinoru/actions-swiftlint** - Alternative with similar features  
- **cirruslabs/swiftlint-action** - For macOS runners

**Standard workflow pattern:**
```yaml
name: SwiftLint
on:
  pull_request:
    paths:
      - '.github/workflows/swiftlint.yml'
      - '.swiftlint.yml'
      - '**/*.swift'

jobs:
  SwiftLint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: GitHub Action for SwiftLint
        uses: norio-nomura/action-swiftlint@3.2.1
        env:
          DIFF_BASE: ${{ github.base_ref }}  # Only files changed in PR
```

**Key feature:** `DIFF_BASE` environment variable to lint only changed files.

#### Reviewdog (Universal PR Comment Tool)
The **gold standard** for posting inline PR comments from any linter output.

**Key capabilities:**
- Parses multiple output formats (errorformat, checkstyle, SARIF, rdjson)
- Multiple reporter modes:
  - `github-pr-check` - GitHub Check annotations
  - `github-pr-review` - Inline PR review comments
  - `github-annotations` - File-level annotations
- Filter modes for diff-only feedback

**Standard workflow:**
```yaml
name: reviewdog
on: [pull_request]
jobs:
  eslint:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write  # Required for PR comments
    steps:
      - uses: actions/checkout@v4
      - uses: reviewdog/action-eslint@v1
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          reporter: github-pr-review  # Inline comments
          filter_mode: file  # Only lint changed files
```

**Critical insight:** GitHub API doesn't support commenting on lines that weren't changed in the PR. Use `filter_mode: file` or `filter_mode: diff_context` to avoid "invisible" comments.

#### Danger (Ruby/Swift/JS)
PR automation tool that runs during CI and posts comments based on rules.

**Pattern:** Define rules in `Dangerfile` → CI runs Danger → Posts PR comments

```ruby
# Dangerfile
warn("PR is too big") if git.lines_of_code > 500
fail("No description provided") if github.pr_body.length < 10

# Run SwiftLint and inline violations
swiftlint.lint_files inline_mode: true
```

**Key insight:** Danger is 100% free and open source. No paid tier. Monetization comes from ecosystem (plugins, consulting).

#### ESLint
Multiple patterns for GitHub integration:
1. **Output to JSON** → Parse with separate action
2. **Use reviewdog/action-eslint** for inline comments
3. **Use eslint-annotate-action** for check annotations

```yaml
- run: eslint --output-file eslint_report.json --format json src
- uses: ataylorme/eslint-annotate-action@v2
  with:
    report-json: eslint_report.json
```

### Standard Workflow File Structure

```yaml
name: Lint
on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  lint:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
      checks: write
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Linter
        id: lint
        run: |
          # Output to JSON/SARIF format
          linter --format json -o results.json
        continue-on-error: true
      
      - name: Post Results
        uses: reviewdog/action-setup@v1
        # OR: Upload SARIF to Security tab
        # OR: Create check annotation
```

### How They Post PR Comments/Annotations

**Three main approaches:**

| Method | API Used | Location | Persistence |
|--------|----------|----------|-------------|
| PR Review Comments | `POST /repos/{owner}/{repo}/pulls/{pull_number}/reviews` | Inline on diff | Until PR closes |
| Check Annotations | Checks API | Files tab, Summary | Tied to commit |
| Issue Comments | `POST /repos/{owner}/{repo}/issues/{issue_number}/comments` | PR conversation | Permanent |

**Required permissions:**
```yaml
permissions:
  pull-requests: write  # For PR comments
  checks: write         # For check annotations
  contents: read        # For repo access
```

### SARIF Format for GitHub Security Tab

**SARIF (Static Analysis Results Interchange Format)** is an OASIS standard for security tool output.

**Key requirements for GitHub:**
- Must be SARIF 2.1.0 JSON schema
- Max file size: 10 MB
- Public repos: Code scanning always available
- Private repos: Requires GitHub Advanced Security

**Upload action:**
```yaml
- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif
    category: swiftlint  # For multiple tools
```

**SARIF structure basics:**
```json
{
  "$schema": "https://raw.githubusercontent.com/oasis-tcs/sarif-spec/master/Schemata/sarif-schema-2.1.0.json",
  "version": "2.1.0",
  "runs": [{
    "tool": {
      "driver": {
        "name": "ShipLint",
        "version": "1.0.0",
        "rules": [...]
      }
    },
    "results": [{
      "ruleId": "rule-id",
      "level": "warning",
      "message": { "text": "..." },
      "locations": [{
        "physicalLocation": {
          "artifactLocation": { "uri": "src/file.swift" },
          "region": { "startLine": 10, "startColumn": 5 }
        }
      }]
    }]
  }]
}
```

**Benefits of SARIF:**
- Results appear in Security tab
- Automatic deduplication via fingerprints
- Severity levels visible in dashboard
- Track fixes over time

### GitHub Actions Marketplace Listing Process

**Requirements for listing:**
1. Public repository
2. Single `action.yml` metadata file per repo
3. Unique action name (can't match existing actions or GitHub usernames)
4. Include branding (icon, color)

**Process:**
1. Create `action.yml` with required fields
2. Create a release with semantic versioning
3. On release page, check "Publish this Action to the GitHub Marketplace"
4. Fill in marketplace details

**For paid apps (not Actions):**
- Requires verified publisher status
- Organization must complete verification process
- Apps reviewed by GitHub before listing

**Important:** Actions are always free. Only GitHub Apps can have paid plans.

---

## 2. GitHub App vs GitHub Action

### When to Use Each

| Aspect | GitHub Action | GitHub App |
|--------|---------------|------------|
| **Best for** | CI/CD tasks, build-time checks | Persistent services, webhooks |
| **Runs on** | GitHub's runners or self-hosted | Your own infrastructure |
| **Triggered by** | Workflow events (push, PR, etc.) | Webhooks, any event |
| **Data persistence** | None (stateless) | Can store data |
| **Cost to run** | Uses Actions minutes | You pay for hosting |
| **Monetization** | Cannot be sold | Can sell on Marketplace |
| **Latency** | Queue time + startup | Instant webhook response |

### Pros and Cons

**GitHub Action:**
✅ Zero infrastructure cost for free tier
✅ Easy to set up (YAML config)
✅ Runs in user's CI (trust model)
✅ Access to repo during workflow
✅ Secret management built-in
❌ Cannot monetize directly
❌ Limited to workflow events
❌ Cold start time
❌ Rate limited by Actions minutes

**GitHub App:**
✅ Can monetize (paid plans)
✅ Instant webhook response
✅ Persistent data storage
✅ Fine-grained permissions
✅ Own identity (not tied to user)
❌ Requires hosting infrastructure
❌ More complex setup
❌ Need to handle auth tokens
❌ Need to maintain uptime

### Examples of Tools Using Both (Free Action + Paid App)

| Tool | Free Tier | Paid Tier |
|------|-----------|-----------|
| **Codacy** | GitHub Action for basic scanning | GitHub App for full dashboard, tracking |
| **SonarCloud** | Free for public repos | Paid for private repos, advanced features |
| **Snyk** | Free Action with limits | Enterprise App with full features |
| **CodeClimate** | Quality Action (limited) | Velocity App (paid) |

**Pattern observed:** The GitHub Action provides basic functionality (lint, scan), while the paid App provides:
- Dashboard & analytics
- Historical tracking
- Team management
- Custom rules
- Priority support

### OAuth Flows & Webhook Handling

**GitHub App Authentication:**

1. **App-level:** JWT signed with private key
2. **Installation-level:** Installation access token (1-hour expiry)
3. **User-level:** OAuth user access token

**Webhook handling pattern:**
```
User installs App → GitHub sends webhook with installation_id
→ App generates JWT → Exchanges for installation token
→ Uses token for API calls (1-hour expiry)
```

**Installation process:**
1. User visits `github.com/apps/{app-name}`
2. Selects which repos to install on
3. Grants requested permissions
4. GitHub redirects to callback URL with `installation_id`
5. App stores installation_id for future API calls

---

## 3. Pricing Models for Dev Tools

### Detailed Comparison

#### Danger (Ruby/JS/Swift)
- **Price:** 100% FREE and open source
- **Model:** No monetization - community-driven
- **Why free:** Created by Artsy (later community)
- **Revenue:** None from Danger itself; consulting/support

#### CodeClimate
- **Quality:** ~$16.67/user/month (annual), $20/month monthly
- **Velocity:** ~$52/user/year (engineering metrics)
- **Model:** Per-seat pricing
- **Free tier:** Open source repos only
- **Enterprise:** Custom pricing for 300+ seats

#### Codacy
- **Open Source:** FREE (public repos only)
- **Pro:** $15/seat/month (up to 30 contributors, 100 private repos)
- **Business:** $40/seat/month (unlimited, SSO, advanced features)
- **Model:** Per-seat (Git contributor who commits to monitored private repo)
- **14-day trial:** Full access, no credit card

#### SonarCloud
- **Free tier:** Public repos unlimited, private repos up to 50K LoC
- **Paid:** Based on lines of code analyzed
  - 100K LoC: ~€10/month
  - 500K LoC: ~€45/month
  - 1M LoC: ~€600/month (recent price increase from ~€267)
- **Model:** Lines of Code (LoC) based
- **Note:** Significant price increases in 2024 (doubled for many tiers)

#### Snyk
- **Free:** Unlimited developers, 200 Open Source tests/month, 100 Code tests/month
- **Team:** $25/contributing developer/month (up to 10 devs)
- **Ignite:** Custom pricing (<100 devs)
- **Enterprise:** Custom pricing
- **Model:** Per contributing developer (commits in last 90 days)
- **Open source:** Contributions to public repos don't count

#### Dependabot
- **Price:** FREE (acquired by GitHub)
- **Integrated:** Into GitHub natively
- **Lesson:** Acquisition can make tools free

### Pricing Model Summary

| Model | Examples | Pros | Cons |
|-------|----------|------|------|
| **Per-seat** | Codacy, CodeClimate | Predictable, scales with team | Expensive for large teams |
| **Per-repo** | Legacy models | Simple | Punishes monorepos |
| **Usage-based (LoC)** | SonarCloud | Pay for what you use | Unpredictable costs |
| **Usage-based (tests)** | Snyk Free | Clear limits | Can hit limits quickly |
| **Freemium + Enterprise** | Most | Low barrier, upsell | Conversion challenge |

### Open Source vs Private Repo Handling

**Common patterns:**

1. **Free for public, paid for private** (SonarCloud, Codacy)
   - Builds goodwill in OSS community
   - Private = monetization

2. **Free tier with limits** (Snyk)
   - X tests/month free
   - Upgrades for more

3. **100% free for OSS projects** (Snyk OSS program)
   - Apply to get full features free
   - PR/marketing value

4. **Contributor-based exclusion** (Snyk)
   - Only count private repo contributors
   - OSS contributions don't consume seats

---

## 4. Adoption & Growth Patterns

### How Successful Dev Tools Grew

**Key patterns observed:**

1. **Bottom-up adoption (Product-Led Growth)**
   - Individual devs try free tier
   - Love it → advocate internally
   - Team adopts → company buys
   - Example: Slack (30%+ conversion)

2. **Open source first**
   - Build community, trust, habit
   - Add paid features later
   - Example: GitLab, Sentry

3. **Expense account threshold**
   - Price under approval threshold (~$10-25)
   - Devs can expense without paperwork
   - Example: Early Atlassian ($10 products)

4. **Land and expand**
   - Free for individuals
   - Paid for teams/orgs
   - Example: GitHub, Notion

### Freemium Conversion Rates

**Industry benchmarks (2021-2025 data):**

| Metric | Rate |
|--------|------|
| Visitor → Freemium signup | 12-15% |
| Freemium → Paid (overall) | 3-5% |
| Developer tools (median) | 5% |
| Non-developer tools (median) | 10% |
| Exceptional (Slack-level) | 30%+ |

**By model:**
- Traditional freemium: 3.7%
- Land & expand: 3.0%
- Opt-in free trial → paid: 17.8%
- Opt-out trial → paid: 49.9%

**Insight:** Developer tools convert at roughly half the rate of non-dev tools due to DIY mindset.

### What Triggers Upgrade from Free to Paid

**Natural upgrade triggers:**

| Trigger | Feature Gating |
|---------|----------------|
| Team growth | "Free for 1 user, paid for teams" |
| Third team member | Team collaboration features |
| Private repos | Security features |
| SSO/SAML requirement | Enterprise security needs |
| Compliance needs | Audit logging, SOC2 |
| Support needs | Priority support SLA |
| Volume limits | More tests, repos, users |
| Advanced features | Custom rules, integrations |

**Best practices:**
- Don't cripple free tier (creates detractors)
- Align upgrade triggers with org growth
- SSO is the classic enterprise gate

### Developer Tool Growth Strategy

**Key principles:**

1. **Prioritize adoption over revenue initially**
   - Word of mouth is everything
   - Happy free users → paying teams later

2. **Product-Led Sales (PLS) hybrid**
   - PLG for initial adoption
   - Sales for enterprise deals
   - Track signals: adoption level, user role, company profile

3. **Feature tiers that make sense:**
   - **Free:** Full functionality for hobbyists
   - **Team:** Collaboration, shared config
   - **Enterprise:** SSO, RBAC, audit logs, SLA

---

## 5. iOS-Specific Considerations

### CI/CD Popularity Among iOS Devs

| Platform | Notes |
|----------|-------|
| **GitHub Actions** | Growing fast, free for public repos, macOS runners expensive |
| **Bitrise** | Mobile-first, very popular for iOS |
| **Xcode Cloud** | Apple's offering, tight Xcode integration |
| **CircleCI** | Fast, flexible, macOS support |
| **Fastlane** | Not CI, but automation layer used with all above |

**macOS runner costs (GitHub Actions):**
- Standard: 10x Linux minutes
- Large: Even more expensive
- Self-hosted: Popular for cost savings

### Fastlane Integration Patterns

Fastlane is the de facto standard for iOS CI automation.

**SwiftLint via Fastlane:**
```ruby
# Fastfile
lane :lint do
  swiftlint(
    mode: :lint,
    output_file: "swiftlint.result.json",
    reporter: "json",
    ignore_exit_status: true
  )
end
```

**GitHub Actions + Fastlane:**
```yaml
- name: Run SwiftLint
  run: bundle exec fastlane lint
```

**Key insight:** Many iOS devs prefer Fastlane over raw GitHub Actions because:
- Same scripts work on local machine
- More iOS-specific actions
- Better Xcode/signing integration

### SwiftLint's Adoption Model

**100% open source** (MIT license)

**Adoption drivers:**
- Maintained by Realm (MongoDB)
- Default in many iOS project templates
- Xcode integration (build phase script)
- VS Code extension
- Fastlane action
- Multiple GitHub Actions

**No monetization** - purely community/corporate goodwill.

### iOS-Specific Tool Landscape

| Tool | Purpose | Price |
|------|---------|-------|
| SwiftLint | Style linting | Free (OSS) |
| SwiftFormat | Code formatting | Free (OSS) |
| Danger Swift | PR automation | Free (OSS) |
| Periphery | Dead code detection | Free (OSS) |
| Sourcery | Code generation | Free (OSS) |
| Fastlane | Automation | Free (OSS) |

**Insight:** iOS tooling ecosystem is heavily open source. Paid tools are mostly for security scanning (Snyk, Codacy) rather than linting.

---

## 6. Recommendations for ShipLint

### Product Strategy

**Recommended approach: Free Action + Premium Dashboard**

1. **Phase 1: Free GitHub Action**
   - Open source core linting
   - PR annotations via reviewdog pattern
   - SARIF output for Security tab
   - Build adoption and credibility
   
2. **Phase 2: Premium Dashboard (GitHub App)**
   - Historical tracking
   - Team analytics
   - Custom rule marketplace
   - Priority support

### Pricing Recommendation

**Tiered model:**

| Tier | Price | Features |
|------|-------|----------|
| **Free** | $0 | Full linting, PR comments, SARIF, public + private repos |
| **Team** | $15/seat/month | Dashboard, historical trends, team settings, shared configs |
| **Enterprise** | $35/seat/month | SSO, custom rules, SLA, dedicated support |

**Justification:**
- Free tier must be generous (dev tool market is competitive)
- $15 matches Codacy Pro, undercuts CodeClimate
- Per-seat is most predictable for customers
- Enterprise gates on SSO (natural enterprise requirement)

### Technical Integration Approach

**GitHub Action structure:**
```yaml
# action.yml
name: 'ShipLint'
description: 'Lint iOS pull requests'
branding:
  icon: 'check-circle'
  color: 'blue'

inputs:
  github_token:
    description: 'GitHub token'
    required: true
  reporter:
    description: 'Reporter type (github-pr-review, github-check, sarif)'
    default: 'github-pr-review'
  config:
    description: 'Path to config file'
    default: '.shiplint.yml'

runs:
  using: 'composite'
  steps:
    - run: shiplint analyze --format ${{ inputs.reporter }}
      shell: bash
```

**Recommended reporters:**
1. **Primary:** `github-pr-review` (inline comments)
2. **Secondary:** SARIF upload to Security tab
3. **Optional:** `github-check` for summary

### Go-to-Market

1. **Immediate:**
   - Publish free Action to Marketplace
   - Write integration guides for Fastlane
   - Support Bitrise, CircleCI, Xcode Cloud
   
2. **Short-term:**
   - Build email list from Action users
   - Create comparison content (vs SwiftLint, vs Codacy)
   - Target iOS communities (Swift forums, iOS Dev Weekly)

3. **Medium-term:**
   - Launch paid dashboard
   - Implement team features
   - Consider Fastlane plugin

### Key Differentiators to Build

**What's missing in the iOS linting market:**

1. **AI-powered suggestions** - Beyond rule-based, actual code improvements
2. **SwiftUI-specific rules** - Underserved in current tools
3. **Performance analysis** - Not just style, but runtime concerns
4. **Design pattern enforcement** - MVVM, Clean Architecture validation
5. **Accessibility linting** - iOS accessibility compliance

### Competitive Positioning

**Don't compete with:**
- SwiftLint (it's free and embedded everywhere)

**Compete with:**
- Codacy (comprehensive but pricey)
- Manual code review (time-consuming)
- Inconsistent team standards (pain point)

**Positioning:** "AI-powered iOS code review that catches what SwiftLint misses"

---

## Appendix: Key Resources

### Technical Documentation
- [GitHub Actions vs Apps](https://docs.github.com/en/actions/get-started/actions-vs-apps)
- [Publishing Actions to Marketplace](https://docs.github.com/en/actions/sharing-automations/creating-actions/publishing-actions-in-github-marketplace)
- [SARIF Support for Code Scanning](https://docs.github.com/en/code-security/code-scanning/integrating-with-code-scanning/sarif-support-for-code-scanning)
- [Reviewdog Documentation](https://github.com/reviewdog/reviewdog)

### Pricing References
- [Codacy Pricing](https://www.codacy.com/pricing)
- [Snyk Plans](https://snyk.io/plans/)
- [SonarCloud Pricing](https://www.sonarsource.com/products/sonarcloud/new-pricing-plans/)
- [Code Climate Quality](https://codeclimate.com/quality/pricing)

### iOS Resources
- [SwiftLint GitHub](https://github.com/realm/SwiftLint)
- [Danger Swift](https://danger.systems/swift/)
- [Fastlane SwiftLint Action](https://docs.fastlane.tools/actions/swiftlint/)
