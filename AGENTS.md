# Agent Instructions — ReviewShield

## Before You Start

1. **Read PRODUCT.md** — Understand what we're building and why
2. **Read the research** — `/root/vault/Signal26/Products/ios-preflight/research/`
3. **Check the roadmap** — `/root/vault/Signal26/Products/ios-preflight/ROADMAP.md`

## Key Principles

**Reduce anxiety, not just errors.** Our users are stressed about rejection. Every feature should help them feel confident.

**Fast and cheap beats thorough.** We're the quick check, not the deep audit. Seconds, not hours.

**Config issues only.** We scan source code. We don't test running apps. Don't scope creep into runtime testing.

## Feature Checklist

**Before proposing ANY feature or rule, answer these:**

- [ ] **Does this reduce submission anxiety?** (If no, reconsider)
- [ ] **Is this a common rejection reason?** (Check Reddit, research)
- [ ] **Can we do this with static analysis?** (No runtime = yes)
- [ ] **Is the fix actionable?** (User knows exactly what to change)
- [ ] **Does it fit our "fast & cheap" positioning?** (Seconds, not hours)

If you can't check all boxes, don't build it.

## Code Standards

- TypeScript, strict mode
- Jest for testing
- Follow existing patterns in `src/rules/`
- Every rule needs tests

## When Adding Rules

Ask: "Is this a common rejection reason?" Check:
- Reddit complaints
- Apple's published guidelines
- Our customer research

Don't add rules for edge cases nobody hits.

## Commit Messages

Use conventional commits:
- `feat:` new features
- `fix:` bug fixes  
- `docs:` documentation
- `chore:` maintenance

## PR Workflow

1. Create feature branch
2. Make changes
3. Push and create PR via `gh pr create`
4. Reviewer agent will review
5. Address feedback
6. Merge when approved

---

## Superpowers Skills

We use the [Superpowers](https://github.com/obra/superpowers) methodology for structured development. Skills are at `~/.codex/superpowers/skills/`.

### Core Workflow

**Before coding anything substantial:**

1. **Brainstorming** → Refine spec through questions, validate design in chunks
   - Read: `~/.codex/superpowers/skills/brainstorming/SKILL.md`

2. **Writing Plans** → Break work into 2-5 min tasks with exact file paths and code
   - Read: `~/.codex/superpowers/skills/writing-plans/SKILL.md`
   - Save plans to: `docs/plans/YYYY-MM-DD-<feature>.md`

3. **Subagent-Driven Development** → Fresh agent per task, two-stage review
   - Read: `~/.codex/superpowers/skills/subagent-driven-development/SKILL.md`
   - Stage 1: Spec compliance review
   - Stage 2: Code quality review

### Key Skills Reference

| Skill | When to Use |
|-------|-------------|
| `brainstorming` | Starting any new feature |
| `writing-plans` | Before touching code |
| `test-driven-development` | RED-GREEN-REFACTOR always |
| `systematic-debugging` | When fixing bugs |
| `requesting-code-review` | Before merging |
| `verification-before-completion` | Before saying "done" |

### TDD Is Mandatory

```
RED    → Write failing test
GREEN  → Write minimal code to pass
REFACTOR → Clean up
COMMIT → After each green
```

**Do not write implementation before tests.** The skill will catch you.

### Two-Stage Review

Every completed task gets:
1. **Spec compliance** — Does it match the plan?
2. **Code quality** — Is it clean, tested, documented?

Critical issues block progress. This is how we caught the monorepo scope issues.
