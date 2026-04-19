# Technology Stack and Choices

**When to read this:** Selecting frameworks, libraries, services, or making technology stack decisions.

**Related Documents:**
- [CLAUDE.md](./../../CLAUDE.md) - Project navigation index
- [CLAUDE.md](./../CLAUDE.md) - Collaboration principles

---

## Takt-specific overrides

For **Takt** specifically, two of the defaults below are deliberately overridden. These overrides apply to this project only.

- **Frontend framework: Vite + React + TS SPA, not Next.js.** Reason: Takt is an app, not a content site; no SSR needs; simpler deploy on Cloudflare. Full rationale: [ADR 2026-04-19 — Vite SPA over Next.js](../../REFERENCE/decisions/2026-04-19-vite-spa-over-nextjs.md).
- **Styling: ported prototype CSS with CSS custom properties, not Tailwind + shadcn/ui.** Reason: the Claude Design prototype is the design; re-expressing it in utility classes buys nothing. Full rationale: [ADR 2026-04-19 — Port prototype CSS](../../REFERENCE/decisions/2026-04-19-port-prototype-css.md).

Everything else in the table below applies as written (TypeScript strict, Cloudflare hosting, Cloudflare D1/KV, Cloudflare Access, Cloudflare Email Sending if needed, Cloudflare Web Analytics). For any further deviation on Takt, write an ADR before proceeding.

---

Reference guide for selecting technologies across projects.

## General preferences

- Free or low cost solutions are always preferred
- We prefer state-of-the-art solutions, but avoid experimental code or beta versions (unless nothing else is available)
- Never use outdated or deprecated solutions
- If a suitable technology doesn't seem to be available, recommend running a deep research task first to understand the topic better and find potential alternatives
- For any selected framework, library, third party component, API or other service, read the manual to ensure you use the latest stable version and follow best practice usage and patterns

## Platform-specific preferences

| Use Case | Preferred Technology | Reason |
| --- | --- | --- |
| CLI/Headless projects | Python | Simplicity and extensive libraries |
| Web application projects | TypeScript (strict mode) | Industry standard type safety |
| Web frontend framework | Next.js (React) with App Router | Server-side rendering and SEO |
| Web frontend design | TailWind CSS for styling with shadcn/ui as component library | Great starting point |
| Hosting of websites and web apps | CloudFlare.com | I already have an account |
| CDN / DNS / Basic data storage | Cloudflare KV | Key-value storage, then other CF options |
| Database, Storage | CloudFlare D1, CloudFlare R2, CloudFlare Images | I already have an account |
| Email communication | CloudFlare Email Sending (Beta) | I already have an account |
| Authentication | Magic link systems (or CloudFlare ZeroTrust) | Simple and secure |
| Payment processing | Stripe.com | Industry leader |
| Web analytics | Cloudflare Web Analytics | Privacy-focused, cookie-free analytics |
