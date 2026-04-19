---
name: review-pr
description: Full-Stack Developer PR Review - use for reviewing changes of a non critical or non architectural nature, for large changes with potential security and architecture impact use the skill /review-pr-team instead.
disable-model-invocation: false
user-invocable: true
argument-hint:
  - PR-number
---
# Full-Stack Developer PR Review

This skill provides a comprehensive pull request review from an experienced full-stack developer perspective, covering code quality, security, functionality, and best practices — plus a dedicated documentation pass.

## How This Works

Two independent reviewers in sequence:
1. A full-stack developer reviews code quality, functionality, security, testing, and architecture
2. A technical writer reviews documentation completeness — REFERENCE/ docs, CLAUDE.md currency, ABOUT comments, and temporal language

---

## Instructions for Claude

When this skill is invoked with a PR number (e.g., `/review-pr 2`):

### Step 1: Spawn Code Reviewer Agent

**CRITICAL:** You must spawn an independent subagent for this review. DO NOT review the PR yourself in this session. The reviewer needs fresh, unbiased context.

Spawn the **`code-reviewer`** subagent with this task:

**Task:** "Conduct a comprehensive code review of PR #$ARGUMENTS. Follow your review checklist and output format. Post nothing — return your full findings when done."

Wait for the review to complete.

---

### Step 2: Spawn Documentation Reviewer Agent

After the code review completes, spawn the **`technical-writer`** subagent with this task:

**Task:** "Conduct a documentation review of PR #$ARGUMENTS. Follow your review checklist and output format. Post nothing — return your full findings when done."

Wait for the documentation review to complete.

---

### Step 3: Post Combined Results

After both reviews are complete, combine their findings and post as a single comment on the PR:

```bash
gh pr comment $ARGUMENTS --body "[combined markdown from both reviews]"
```

Structure the combined comment with code review findings first, documentation findings second. If the documentation reviewer found no issues, a brief "✅ Documentation: No issues found" is sufficient.

Provide user summary:
- Total issues found (critical vs suggestions), split by code vs documentation
- Clear recommendation (approve/request changes)
- Key action items
- Link to PR comment

---

## Example Usage

```
/review-pr 2
```

This will:
1. Spawn independent full-stack developer reviewer
2. Reviewer gathers their own context (PR details, CLAUDE.md, specs, changed files)
3. Reviewer conducts comprehensive review
4. Spawn independent technical writer reviewer
5. Technical writer checks documentation completeness
6. Post combined review to the PR

---

## Tips for Best Results

- **Use for all implementation PRs** - Quick sanity check with documentation verification
- **Faster than multi-perspective** - ~2-4 minutes vs 5-10 minutes
- **Broad coverage** - Catches most common issues plus documentation drift
- **Upgrade to /review-pr-team** - For critical/complex PRs needing deep analysis

---

## When to Use Which Review

**Use `/review-pr`:**
- Regular implementation PRs
- Quick sanity checks
- You want fast feedback
- Standard feature work

**Use `/review-pr-team`:**
- Critical infrastructure changes
- Security-sensitive features
- Major architectural decisions
- Need multiple expert perspectives
