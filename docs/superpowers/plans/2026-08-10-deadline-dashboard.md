# Personal Gmail Deadline Dashboard Implementation Plan (archived frontend prototype)

> Historical document. The current Vercel/Supabase implementation is documented in the repository README.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a responsive, dashboard-first IIMK deadline pilot prototype with synthetic data, interactive student workflows, moderator review, and explicit privacy boundaries.

**Architecture:** A Vinext/Next.js App Router shell renders one client-side workspace component. Product data and interaction types live in a focused data module; ephemeral UI state powers tabs, progress changes, reviews, and moderator actions without representing durable or connected services. Styling remains in one global stylesheet and the hosting configuration keeps database and object storage bindings disabled because this release is a privacy-safe prototype.

**Tech Stack:** Next.js-compatible Vinext, React 19, TypeScript, CSS, Node test runner, Sites hosting.

## Global Constraints

- Use only synthetic people, deadlines, mail, spend, and audit data.
- Do not imply live Gmail, Supabase, Anthropic, or institutional OAuth access.
- Make shared announcements and private student overlays visually distinct.
- Include All, Case Comps, Committees, Placements, and Academics filters.
- Include stale/sync health, review inbox, moderator decisions, privacy controls, and seven-day test-mode reconnection disclosure.
- Keep progress changes, private dates, and review decisions in current-session state only.
- Meet responsive, keyboard, reduced-motion, and WCAG-oriented contrast requirements.
- Do not add email, browser, or push notifications.

---

### Task 1: Product Contract and Rendering Test

**Files:**
- Modify: `tests/rendered-html.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: the generated `dist/server/index.js` worker from the deployment build.
- Produces: rendered-page assertions for product metadata, navigation, sync status, agenda content, privacy disclosure, and removal of starter assets.

- [ ] **Step 1: Replace starter assertions with failing product assertions**

Assert that the server-rendered HTML contains `Kampus`, `Deadline runway`, `Review inbox`, `Moderator queue`, `gmail.readonly`, `30 days`, and `Synthetic pilot data`; assert that it does not contain `codex-preview`, `Your site is taking shape`, or `react-loading-skeleton`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm run build && node --test tests/rendered-html.test.mjs`

Expected: FAIL because the starter still renders its loading skeleton and starter metadata.

- [ ] **Step 3: Remove the unused loading-skeleton dependency**

Delete `react-loading-skeleton` from `dependencies` and refresh the lockfile with `pnpm install --lockfile-only`.

- [ ] **Step 4: Keep the failing test as the acceptance contract**

Run: `node --test tests/rendered-html.test.mjs`

Expected: FAIL with a missing product-title or product-copy assertion, not a syntax error.

### Task 2: Dashboard Data Model and Interactive Workspace

**Files:**
- Create: `app/dashboard-data.ts`
- Create: `app/Dashboard.tsx`
- Modify: `app/page.tsx`
- Delete: `app/_sites-preview/SkeletonPreview.tsx`
- Delete: `app/_sites-preview/preview.css`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Produces: `Category`, `StageStatus`, `Agenda`, `ReviewItem`, and `ModeratorProposal` types; `agendas`, `reviewItems`, and `moderatorProposals` synthetic datasets; default `Dashboard` component.
- Consumes: no live services, browser secrets, raw emails, or persistent storage.

- [ ] **Step 1: Define the synthetic product model**

Create exact union types for category and stage status, then seed four agendas spanning Case Comps, Placements, Committees, and Academics. Each agenda includes stable ID, shared/private classification, deadline, countdown, source label, confidence, detail, and at least one stage.

- [ ] **Step 2: Implement the minimal workspace to satisfy the product contract**

Build a client component with navigation modes (`dashboard`, `reviews`, `moderator`, `privacy`), category filtering, expandable agenda stages, progress buttons, private-date conflict entry, review resolution actions, moderator proposal actions, and an account menu. Keep all mutations in React state and label the interface as synthetic/demo data.

- [ ] **Step 3: Replace the starter page**

Render `<Dashboard />` from `app/page.tsx` and export page metadata with the title `Kampus — Your deadline runway` and a privacy-focused description. Remove the temporary preview metadata marker.

- [ ] **Step 4: Remove the disposable starter preview**

Delete `app/_sites-preview` after removing every import.

- [ ] **Step 5: Run the acceptance test**

Run: `pnpm run build && node --test tests/rendered-html.test.mjs`

Expected: product assertions pass; styling assertions may remain for Task 3.

### Task 3: Responsive Editorial Interface and Accessibility

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`
- Modify: `public/favicon.svg`
- Test: `tests/rendered-html.test.mjs`

**Interfaces:**
- Consumes: stable class names and semantic controls from `Dashboard.tsx`.
- Produces: ivory/ink/forest/saffron design tokens, desktop rail and mobile header layouts, agenda/review/moderator/privacy surfaces, visible focus states, and reduced-motion handling.

- [ ] **Step 1: Add a failing styling-source assertion**

Assert that `app/globals.css` includes `:focus-visible`, `prefers-reduced-motion`, a mobile breakpoint, and distinct `.scope-private` and `.scope-shared` treatments.

- [ ] **Step 2: Verify the styling assertion fails**

Run: `node --test tests/rendered-html.test.mjs`

Expected: FAIL because the starter stylesheet lacks the product tokens and accessibility rules.

- [ ] **Step 3: Implement the design system and responsive layout**

Replace the starter stylesheet with a complete product stylesheet using CSS variables for the approved palette, editorial typography, compact badges, urgency treatments, dashboard grids, responsive stacking, hover/focus states, and motion reduction.

- [ ] **Step 4: Update global metadata and icon**

Set the finished product title/description in `app/layout.tsx`, remove starter icon references where replaced, and create a simple typographic/CSS-compatible favicon asset without using decorative SVG illustrations in the page.

- [ ] **Step 5: Run build and tests**

Run: `pnpm run build && node --test tests/rendered-html.test.mjs`

Expected: PASS.

### Task 4: Social Preview, Final Validation, and Publishing

**Files:**
- Create: `public/og.png`
- Modify: `app/layout.tsx`

**Interfaces:**
- Consumes: final `Kampus` copy, palette, urgency motif, and privacy positioning.
- Produces: validated 1200×630 social preview metadata and a deployable Sites version.

- [ ] **Step 1: Generate one product-specific social card**

Create a landscape card with the exact text `Kampus` and `Your deadline runway`, warm ivory background, ink typography, forest-green sync cue, saffron urgency marker, and a compact agenda-card motif.

- [ ] **Step 2: Inspect the image text**

Verify that the title and headline are correct and that no invented product claims appear. Omit the image rather than shipping it if validation fails after the permitted retry.

- [ ] **Step 3: Wire dynamic absolute social metadata**

Add Open Graph and X metadata that derives an absolute `/og.png` URL from the incoming request host while preserving the product title and description.

- [ ] **Step 4: Run final validation**

Run: `pnpm run build && node --test tests/rendered-html.test.mjs`

Expected: PASS with no starter preview references.

- [ ] **Step 5: Publish through Sites**

Save the validated source as a new Sites version, deploy it privately, wait for deployment completion, and return the deployed URL as the primary deliverable.
