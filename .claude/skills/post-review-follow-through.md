# Post-review follow-through

Referenced by `/review-pr` (Step 4) and `/review-pr-team` (Step 3) after a PR review comment has been posted.

---

## When to run

Run after every review. If the review returned no findings at all, skip to a single line:

> ✅ Clean — nothing to follow up on.

---

## Step 1: Re-bucket findings by action, not severity

Reviewer output uses 🔴/⚠️/💡 severity. Translate each finding into one of three action tiers — this is a deliberate re-categorisation, not a 1:1 mapping:

| Tier                  | Criteria                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Handle in this PR** | Technical solution is clear: bugs, code quality, doc gaps for code the PR touched, missing ABOUT comments, failing tests, minor tech debt, small style/convention fixes. **Default bucket — most findings land here. Minor does not mean defer — if it can be done in a few minutes, do it now.**                                                                                                                                                                                                                                              |
| **Your call**         | Involves a UX or scope tradeoff the operator needs to decide. Present the options in plain English with your recommendation. A 🔴 in this tier still blocks merge until decided.                                                                                                                                                                                                                                                                                                                                                               |
| **Track as issue**    | Out of scope **and** non-trivial: work that requires a separate investigation, affects unrelated systems, or represents a distinct feature/story. The bar is high — only reach for this bucket when the work truly cannot be done as part of this PR. **Never create a GitHub Issue for:** documentation gaps, ABOUT comments, evergreen-language fixes, minor code quality or style improvements, or anything resolvable in a few lines. A GitHub Issue for a 5-minute fix costs more (time spent triaging it later) than just fixing it now. |

When in doubt, default to **Handle in this PR**.

---

## Step 2: Deliver the follow-up

Use this exact format. **Skip any bucket that has nothing in it — don't emit empty headers.**

> **Done — [N] critical issue(s) to fix before merge.** _(or: no blockers)_
>
> **I'll handle these in this PR** _(confirm and I'll go):_
>
> - Update `REFERENCE/api.md` — the new endpoint isn't documented
> - Add ABOUT comments to `src/lib/auth.ts` (new file)
>
> **Your call:**
>
> - The auth flow skips email verification on social logins — users may be surprised. My recommendation: add a "verify on first login" prompt. Your choice.
>
> **Tracking as GitHub issues** _(shall I create these?):_
>
> - `BUG: Pre-existing race condition in payment retry path — unrelated to this PR, needs separate investigation`
> - `FEATURE: Add SAML SSO login — came up in review discussion, distinct piece of work`

Plain English throughout. No technical jargon in the "Your call" or "Tracking" sections unless it genuinely aids clarity.

---

## Step 3: Create GitHub issues (after confirmation)

1. Run `gh label list` once. If `technical-debt` is absent, create it:
   ```bash
   gh label create "technical-debt" --description "Known shortcuts to revisit" --color "e4e669"
   ```
2. Create each issue:

   ```bash
   gh issue create --title "LABEL: description" --label "label-name" --body "..."
   ```

   - Title prefix: **uppercase** (`BUG:`, `ENHANCEMENT:`, `DOCUMENTATION:`, `TECHNICAL DEBT:`)
   - `--label` value: **lowercase, hyphenated** GitHub label name (`bug`, `enhancement`, `documentation`, `technical-debt`)

3. Issue body: what was found, which PR surfaced it, recommended fix if known.

**Standard labels:** `bug` · `documentation` · `enhancement` · `technical-debt`
