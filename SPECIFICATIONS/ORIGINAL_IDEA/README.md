# ORIGINAL_IDEA

Source-of-truth documents for Takt: what it is, why it exists, and the decisions that shape every phase. These documents are written once and kept stable — they're what future-you (and future contributors) come back to when a question has drifted from "how do we build this" to "why are we building this at all".

Phase specs and ADRs reference this folder but don't duplicate it.

## Files

- **[project-outline.md](./project-outline.md)** — the master specification. Origin and problem, product principles, scope (in and out), users, architecture overview, voice pipeline, auth model, data and privacy posture, rate limiting, i18n, offline behaviour, admin backend, design, accepted risks, open questions.

## When to add a file here

- Something is load-bearing for the project's *intent* and is unlikely to change as implementation progresses.
- A future decision will reference this doc to check whether it still holds.

If it's a *how it works* doc (how a feature is implemented), it belongs in [REFERENCE/](../../REFERENCE/). If it's a *how we're going to build this next* plan, it belongs in a numbered phase spec one level up.
