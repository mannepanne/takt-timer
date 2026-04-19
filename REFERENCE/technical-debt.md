# Technical debt tracker

**When to read this:** Planning a refactor, deciding whether to fix something now or later, or documenting an accepted shortcut at the end of a phase.

**Related documents:**
- [CLAUDE.md](../CLAUDE.md) — project navigation.
- [testing-strategy.md](./testing-strategy.md) — coverage expectations.
- [troubleshooting.md](./troubleshooting.md) — operational issues.

---

Tracks known limitations, accepted shortcuts, and deferred improvements in Takt. Items here are deliberate decisions, not bugs.

---

## How it works

- Each item has an ID: `TD-001`, `TD-002`, etc. IDs are allocated sequentially — once given, never reused.
- Phase specs may declare *anticipated* debt (e.g. "TD-002 will be introduced in Phase 3 — English-only Whisper hint, resolved in Phase 5"). When the phase lands, the item moves from the phase spec into this tracker.
- Low-risk items can live here indefinitely. High-risk items should have a resolution phase.

---

## Active technical debt

*(No items yet — this tracker is populated as phases land.)*

---

## Anticipated debt by phase

These are debt items declared in phase specs that will become active when the phase ships. Listed here for forward visibility.

- **TD-001** (Phase 2): Sound toggle on a transient UI location, not yet in Settings. Moves to Settings in Phase 5. Risk: Low.
- **TD-002** (Phase 3): Hard-coded English language hint for Whisper. Swedish arrives in Phase 5. Risk: Low.
- **TD-003** (Phase 3): IP-based rate limiter only; authenticated-user tier added in Phase 4. Risk: Low.
- **TD-004** (Phase 4): `isAdmin` flag set by hand in D1 until Phase 6 automates it. Acceptable because only Magnus needs admin before Phase 6. Risk: Low.
- **TD-005** (Phase 4): No admin UI yet; users table inspected via direct D1 queries until Phase 6. Risk: Low.
- **TD-006** (Phase 5): Missing-i18n-key warning is log-only, not a build-time check. Acceptable for two languages; revisit if a third lands. Risk: Low.

---

## Resolved items

*(Items move here when addressed, with resolution notes and the PR or phase that resolved them.)*

---

## Entry format

```markdown
### TD-NNN: Short description

- **Location:** `path/to/file.ts` — `functionName`
- **Issue:** What limitation or shortcut exists.
- **Why accepted:** The reasoning at the time.
- **Risk:** Low / Medium / High.
- **Resolution phase:** Phase number, or "open" if deliberately indefinite.
- **Future fix:** How to address it when the time comes.
```
