# Post-review follow-through

Referenced by `/review-pr` (Step 4) and `/review-pr-team` (Step 4) after a PR review comment has been posted.

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
| **Your call**         | Involves a UX or scope tradeoff the operator needs to decide. **Always present a default recommendation.** If you can't pick a default, the item belongs in "Handle in this PR" with your best guess as the action — "Your call" is not a hedge for items where you have a preference but didn't want to state it. A 🔴 in this tier still blocks merge until decided.                                                                                                                                                                         |
| **Track as issue**    | Out of scope **and** non-trivial: work that requires a separate investigation, affects unrelated systems, or represents a distinct feature/story. The bar is high — only reach for this bucket when the work truly cannot be done as part of this PR. **Never create a GitHub Issue for:** documentation gaps, ABOUT comments, evergreen-language fixes, minor code quality or style improvements, or anything resolvable in a few lines. A GitHub Issue for a 5-minute fix costs more (time spent triaging it later) than just fixing it now. |

When in doubt, default to **Handle in this PR**.

---

## Step 2: Deliver the follow-up

Use this exact format. **Skip any bucket that has nothing in it — don't emit empty headers.**

> **Done — [N] critical issue(s) to fix before merge.** _(or: no blockers)_
>
> **I'll handle these in this PR** _(confirm and I'll go — reply "yes" for all, or name the specific items you want handled; I'll apply the changes to the current PR branch and commit them):_
>
> - Update `REFERENCE/api.md` — the new endpoint isn't documented
> - Add ABOUT comments to `src/lib/auth.ts` (new file)
>
> **Your call:**
>
> - The auth flow skips email verification on social logins — users may be surprised. My recommendation: add a "verify on first login" prompt. Your choice.
>
> **Tracking as GitHub issues** _(shall I create these? Reply "yes" for all, or name specific ones):_
>
> - `BUG: Pre-existing race condition in payment retry path — unrelated to this PR, needs separate investigation`
> - `FEATURE: Add SAML SSO login — came up in review discussion, distinct piece of work`

Plain English throughout. No technical jargon in the "Your call" or "Tracking" sections unless it genuinely aids clarity.

**Partial confirmation.** If the operator confirms some items and rejects or skips others (e.g. _"yes to 1 and 3, no on 2"_, or _"yes to 1, skip 2, yes to 3"_), treat the unconfirmed items as deferred — no action, no issue created, no follow-up nag in this turn. Before applying any changes, state explicitly which items you're acting on and which you're dropping, so the operator can correct you if you parsed wrong.

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

3. Issue body — use this skeleton so issues stay consistent and searchable:

   ```
   ## Finding
   <one paragraph: what was found, plus the file/location it lives in>

   ## Source
   Surfaced by review of <full PR URL>. <One line: why this is out-of-scope and non-trivial.>

   ## Suggested fix
   <If known. Otherwise: "Needs investigation.">
   ```

   Use the **full PR URL** (not just the number) so the issue is navigable from the Issues UI without the repo URL pre-loaded in the reader's head.

**Standard labels:** `bug` · `documentation` · `enhancement` · `technical-debt`
