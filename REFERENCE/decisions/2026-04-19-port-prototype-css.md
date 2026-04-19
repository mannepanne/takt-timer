# ADR: Port prototype CSS instead of Tailwind + shadcn/ui for Takt

**Date:** 2026-04-19
**Status:** Active

---

## Decision

Takt's styling is a direct port of the prototype's hand-written CSS (`SPECIFICATIONS/prototype-design-files/styles.css`), using CSS variables and component-scoped class names. We deviate from the project-wide default (Tailwind CSS + shadcn/ui) for this project only.

## Context

The prototype was produced with Claude Design and represents the *entire* design intent for v1: typography (Figtree + JetBrains Mono), spacing, motion, the six accent palettes, the iOS-frame desktop treatment, the subtle animations (mic pulse, flash-in, drawer transitions), and the component shapes (pill buttons, stepper sheets, set dots, progress bar). It is tight, opinionated, and works.

The default stack for Magnus projects is Tailwind + shadcn/ui — an excellent *starting point* for projects with no existing design language. Takt has a design language already.

## Alternatives considered

- **Tailwind CSS + shadcn/ui (the project default).** Rejected: we would spend real effort re-expressing a finished design in utility classes and unstyling shadcn primitives to match the prototype. Pure cost, no benefit. shadcn's component set (dialogs, comboboxes, tables) is aimed at dashboards, not a six-screen mobile timer.
- **Tailwind alone, no shadcn.** Same drawback at smaller scale — translating every `styles.css` rule into utility classes buys nothing when we already have the CSS we want.
- **CSS Modules.** Viable alternative to direct `styles.css` porting; adds a build-step abstraction without solving a real problem at this scale. Revisit if the CSS file grows past a few hundred lines or class collisions become a real issue.
- **Styled-components or Emotion.** Runtime overhead, extra tooling, no benefit for a design that's already static CSS.
- **Chosen: port the prototype's CSS as-is, organised with CSS variables for theming and a small set of utility classes.** The prototype already structures the design with CSS custom properties for accent colours, typography, and spacing. Keeping that structure means the accent-theming feature is almost free.

## Reasoning

- The design is done. The build job is to make it real and interactive, not to re-express it.
- CSS variables in the prototype map cleanly to the accent-colour feature: swapping `--accent`, `--accent-deep`, `--accent-soft` at runtime drives the whole theme. This is a central feature, not an afterthought.
- The prototype's CSS file is modest (~500 lines) — not a scaling problem.
- No component-library dependency means fewer bytes on the wire, faster first paint on mobile, and no upgrade treadmill for a library whose components we mostly wouldn't use.
- Port-as-is also means port-as-is for motion: the flash-in and pulse animations are already defined as `@keyframes` in the prototype's stylesheet.

## Trade-offs accepted

- **Breaks the default.** Future Magnus-project readers expect Tailwind. This ADR is the first stop for explaining why Takt is different.
- **No shadcn accessibility defaults.** We re-implement or port accessibility primitives (focus states, aria attributes, keyboard handling) ourselves. The prototype already has the visual pieces; we add the behaviour. Documented as work in the relevant phases.
- **Less visual consistency across Magnus projects.** Fine — Takt is deliberately its own aesthetic.
- **If the design scope later balloons** (more screens, more components), hand-rolled CSS starts to feel heavy. At that point the right move is to introduce CSS Modules or a zero-runtime styling layer — not to retrofit Tailwind.

## Implications

- Enables: faithful execution of the prototype, direct use of its CSS variables for theming, small bundle, no component-library lock-in.
- Prevents: "grab a shadcn component off the shelf" — everything we need, we build from the prototype's primitives. In practice this means a small handful of components (button, sheet/drawer, stepper, dot-indicator) — well within scope.

---

## References

- Related ADRs: [2026-04-19-vite-spa-over-nextjs.md](./2026-04-19-vite-spa-over-nextjs.md)
- Project outline: [../../SPECIFICATIONS/ORIGINAL_IDEA/project-outline.md](../../SPECIFICATIONS/ORIGINAL_IDEA/project-outline.md)
- Prototype CSS: [../../SPECIFICATIONS/prototype-design-files/styles.css](../../SPECIFICATIONS/prototype-design-files/styles.css)
- Technology defaults: [../../.claude/COLLABORATION/technology-preferences.md](../../.claude/COLLABORATION/technology-preferences.md)
