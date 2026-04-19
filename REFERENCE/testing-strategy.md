# Testing strategy

**When to read this:** Writing tests, setting up coverage, deciding what to mock, or adding a new category of test.

**Related documents:**
- [CLAUDE.md](../CLAUDE.md) — project navigation.
- [.claude/CLAUDE.md](../.claude/CLAUDE.md) — collaboration principles, testing section.
- [pr-review-workflow.md](./pr-review-workflow.md) — review process.

---

## Philosophy — tests as development guardrails

Tests in Takt serve two purposes:

1. **Validation** — verify the code does what it should.
2. **Directional context** — act as executable specifications that guide future changes, including AI-driven ones.

This matters because Takt is built with AI assistance at every step. Tests are the most durable way to communicate intent across sessions. A passing test says *"this behaviour is meant to be here"*. A failing test after a change says *"you just drifted from intent — reconsider before you fix the test"*.

---

## Principles

1. **Tests define expected behaviour.** Write them before the code when the shape of the API is clear; right after the code when exploring. Either way, every non-trivial branch has a test.
2. **Coverage targets:** ≥95% lines / functions / statements, ≥90% branches. Targets are for the whole project; individual files may dip lower if justified in PR.
3. **Fail loudly, helpfully.** A failing assertion should name the expected and actual values, and the test's `describe`/`it` names should read like a sentence (*"parses 'three sets of one minute' into 3 × 60"*).
4. **Tests are self-contained.** Each test sets up its own fixtures and cleans up after itself. No cross-test dependencies; tests pass in isolation and in any order.
5. **Mirror code structure.** `src/lib/timer/machine.ts` → `src/lib/timer/machine.test.ts`. Integration tests live alongside the thing they integrate (e.g. `worker/api/voice/parse.test.ts`).

---

## Framework

**Runner:** [Vitest](https://vitest.dev/).
- Fast, TypeScript-first, ES modules native.
- Works with Vite and with `@cloudflare/vitest-pool-workers` for Worker-runtime tests.

**Coverage:** Vitest with `@vitest/coverage-v8`.

**UI-level tests:** `@testing-library/react` for React components.

**Worker tests:** `@cloudflare/vitest-pool-workers` where a real Workers runtime matters (Workers AI calls, D1 queries against a local `miniflare` DB). Plain Vitest for anything else.

### Install (Phase 1)

```bash
pnpm add -D vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event jsdom
# Worker-runtime pool (phase 3+ when API routes land)
pnpm add -D @cloudflare/vitest-pool-workers
```

Configuration in `vitest.config.ts` (SPA tests) and `vitest.workers.config.ts` (Worker tests).

---

## Test categories

### 1. Unit tests

Pure functions, state reducers, small helpers. No I/O, no external deps.

**Takt examples:**
- `src/lib/timer/machine.ts` — the timer state machine (phase transitions, pause/resume, skip, repeat, completion).
- `src/lib/history.ts` — `localStorage` history: append, cap, read, corrupted-JSON recovery.
- `src/i18n/detect.ts` — locale detection.
- `worker/api/voice/interpret.ts` — Llama-response validation with `zod`.

```typescript
// src/lib/timer/machine.test.ts
import { describe, it, expect } from 'vitest';
import { step, initial } from './machine';

describe('timer machine', () => {
  it('advances work → rest at the end of a work phase', () => {
    const s0 = initial({ sets: 3, workSec: 60, restSec: 30 });
    const s1 = step(s0, { type: 'tick', now: 60_000 });
    expect(s1.phase).toBe('rest');
  });
});
```

### 2. Component tests

React components rendered with Testing Library. Assert what the user sees and can do, not implementation details.

**Takt examples:**
- `Wordmark`, `TopBar`, `SetDots`, `StepperSheet`, `VoiceOverlay`, `PresetsDrawer`.

```typescript
// src/components/SetDots.test.tsx
import { render, screen } from '@testing-library/react';
import { SetDots } from './SetDots';

it('marks the active set', () => {
  render(<SetDots total={3} currentIdx={1} phase="work" />);
  const dots = screen.getAllByRole('listitem');
  expect(dots[1]).toHaveClass('active');
});
```

### 3. Worker / integration tests

API routes tested against a real Workers runtime with `@cloudflare/vitest-pool-workers`. D1 queries run against miniflare's in-memory DB; Workers AI and external services are mocked.

**Takt examples:**
- `worker/api/voice/parse.test.ts` — happy path, rate-limit enforcement, Llama-retry behaviour, mic-permission-denied shape.
- `worker/api/auth/registration.test.ts` — WebAuthn registration + signature counter.
- `worker/api/presets/*.test.ts` — CRUD + authorisation.

### 4. End-to-end (smoke) tests

A thin set, not a pyramid inversion. Used at phase boundaries to catch regressions across the integrated system. Can be added with Playwright from Phase 3 onwards if needed, but not required up front.

**Candidate flows:**
- Configure → Run → Complete, in both English and Swedish (Phase 5+).
- Register → sign out → sign in on a simulated second device (Phase 4+).

---

## Mocking strategy

### Always mock

- **Workers AI** — never call it from tests. Wrap calls in thin functions and stub them.
- **WebAuthn browser APIs** — use `@simplewebauthn/server`'s test utilities.
- **`navigator.mediaDevices.getUserMedia`** — return a stubbed `MediaStream`.
- **`AudioContext`** — verify what was scheduled, not that it produced sound.
- **`navigator.wakeLock`** — stub `request()`; assert it's called and released.
- **`localStorage`** — provide a fresh in-memory implementation per test (jsdom does this by default, but clear between tests).

### Never mock

- **The timer state machine**, the rate-limit logic, the i18n detector, any pure business logic.
- **`zod` schemas.** Test them by passing real (and deliberately-wrong) values.

Mocking core logic defeats the purpose of testing.

### Shared mocks

Reusable mocks in `src/test-utils/` and `worker/test-utils/`:

```typescript
// worker/test-utils/ai-mock.ts
export function mockWorkersAI(overrides?: {
  whisper?: string;
  llama?: unknown;
}) {
  return {
    run: vi.fn(async (model: string) => {
      if (model.includes('whisper')) {
        return { text: overrides?.whisper ?? 'three sets of one minute, thirty seconds rest' };
      }
      return { response: JSON.stringify(overrides?.llama ?? { sets: 3, workSec: 60, restSec: 30 }) };
    }),
  };
}
```

---

## Coverage expectations per area

| Area | Lines / functions / statements | Branches | Notes |
|---|---|---|---|
| Pure logic (`src/lib/`, `worker/lib/`) | 98%+ | 95%+ | Tight budget; small surface. |
| React components | 90%+ | 85%+ | Focus on interactions users can take. |
| API routes | 95%+ | 90%+ | Include rate-limit, auth, and error paths. |
| Service worker | 85%+ | 80%+ | Hard to fully exercise; compensate with manual checks. |

Whole-project floors: ≥95% lines/functions/statements, ≥90% branches. Phase specs may set phase-specific overrides.

---

## TDD workflow

### New feature

1. Write a failing test that describes the intended behaviour.
2. Write the minimum code to make it pass.
3. Refactor with the test as a safety net.
4. Repeat for the next behaviour.

### Bug fix

1. Write a failing test that reproduces the bug.
2. Fix the bug.
3. Keep the test — it prevents regression.

### Refactor

1. Run existing tests — they should pass.
2. Refactor.
3. Tests still pass, coverage unchanged.

---

## Running tests

```bash
pnpm test                         # Run once
pnpm test:watch                   # Watch mode, for TDD
pnpm test:coverage                # With coverage report
pnpm test -- path/to/file         # Focused run
```

Pre-commit hook runs `pnpm test` and `pnpm typecheck`. PR CI additionally checks coverage thresholds and lint.

---

## What tests don't cover

Tests validate *correctness*. They do not guarantee:
- **UX quality** — manual testing on real phones during each phase.
- **Audio and haptic fidelity** — verify on device.
- **Performance at scale** — monitor in production, profile on demand.
- **Security against novel attacks** — use `/review-pr-team` for security-sensitive phases; keep security headers and input validation disciplined.
- **Voice-parsing quality across accents and noise** — covered by phase bake-offs against a set of canonical phrases.

---

## Writing good test names

Read as sentences.

**Good:**
```typescript
it('parses "three sets of one minute" into 3 × 60s work, 0s rest');
it('rejects a voice call after three successful calls from the same IP in 24 hours');
it('clears local history after the user accepts the import-on-register prompt');
```

**Bad:**
```typescript
it('works');
it('test voice');
it('returns error');
```

---

## Organising tests with `describe`

Group related tests by behaviour, not by method name.

```typescript
describe('voice parse', () => {
  describe('happy path', () => {
    it('returns a structured session for a canonical phrase');
    it('returns intent=save_preset for a save phrase with a name');
  });

  describe('error handling', () => {
    it('retries Llama once on schema failure, then returns an error');
    it('returns 429 after the anonymous IP limit is reached');
  });
});
```
