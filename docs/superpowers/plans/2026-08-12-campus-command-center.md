# Kampus Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign Kampus as an energetic, modern productivity dashboard without altering its task, Gmail, Ask Kampus, moderation, privacy, or Supabase behaviour.

**Architecture:** Keep `Dashboard` as the state and route-contract owner. Extract only presentational desktop/mobile navigation and the Up-next deadline selection into focused components; preserve `DashboardView` action props and all existing optimistic updates. Replace the current editorial CSS token system with Command Center tokens and component styles, while retaining semantic markup and responsive accessibility behaviour.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind import plus global CSS, Vitest/node test runner, React Testing Library, Playwright.

## Global Constraints

- Do not change Supabase tables, migrations, RLS, API URLs, Gmail scopes, sync logic, Anthropic usage, or Ask Kampus limits.
- Keep Google-only IIMK sign-in and separate optional Gmail consent unchanged.
- Keep all task mutations optimistic and local; no `router.refresh()` or page reload after task or sync actions.
- Use deep navy, white, electric blue, lime, coral, and stable category colours; all text/state combinations must meet WCAG AA contrast.
- Preserve focus trapping/restoration, keyboard category navigation, 14px minimum button text, and reduced-motion support.
- Do not add heavy illustration, video, a UI framework, or non-essential runtime dependencies.

---

## File structure

- `app/dashboard/presentation.ts`: pure helpers for choosing the single Up-next agenda and deriving stable visual urgency labels.
- `app/dashboard/AppNavigation.tsx`: desktop rail and mobile bottom navigation using the existing `AppView` values and role-aware items.
- `app/dashboard/UpNext.tsx`: presentational primary-deadline strip that delegates opening to the existing `toggleAgenda` callback.
- `app/Dashboard.tsx`: composes navigation, passes the selected agenda to the dashboard view, and owns all existing state/actions.
- `app/dashboard/DashboardView.tsx`: renders the Up-next strip, concise heading, tabs, dense task rows, and unchanged detailed controls.
- `app/login/page.tsx` and `app/login/GoogleSignInButton.tsx`: apply the Command Center entry appearance and clear IIMK Google action copy without changing OAuth parameters.
- `app/globals.css`: replaces editorial visual tokens and defines responsive Command Center component styles plus reduced-motion fallback.
- `tests/dashboard-presentation.test.mjs`: verifies deterministic next-task selection and urgency labels.
- `tests/dashboard-accessibility.test.tsx`: verifies navigation and Up-next semantics at component level.

## Task 1: Add pure deadline-priority presentation helpers

**Files:**
- Create: `app/dashboard/presentation.ts`
- Modify: `tests/dashboard-presentation.test.mjs`

**Interfaces:**
- Consumes: `Agenda` from `app/dashboard-data.ts`.
- Produces: `selectUpNext(agendas: Agenda[], nowMs: number): Agenda | null` and `deadlineTone(agenda: Agenda, nowMs: number): "urgent" | "soon" | "standard"`.

- [ ] **Step 1: Write the failing tests**

```js
import { deadlineTone, selectUpNext } from "../app/dashboard/presentation.ts";

test("selectUpNext chooses the nearest future deadline before overdue items", () => {
  const agendas = [agenda({ id: "past", deadline: "2026-08-11T08:00:00Z" }), agenda({ id: "next", deadline: "2026-08-12T12:00:00Z" }), agenda({ id: "later", deadline: "2026-08-14T12:00:00Z" })];
  assert.equal(selectUpNext(agendas, Date.parse("2026-08-12T08:00:00Z"))?.id, "next");
});

test("deadlineTone uses the 24-hour urgent threshold", () => {
  assert.equal(deadlineTone(agenda({ deadline: "2026-08-12T20:00:00Z" }), Date.parse("2026-08-12T08:00:00Z")), "urgent");
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `pnpm test:node -- tests/dashboard-presentation.test.mjs`

Expected: FAIL because `app/dashboard/presentation.ts` does not export the functions.

- [ ] **Step 3: Implement the minimal helpers**

```ts
import type { Agenda } from "../dashboard-data";

export function selectUpNext(agendas: Agenda[], nowMs: number): Agenda | null {
  return agendas.filter((agenda) => new Date(agenda.deadline).getTime() >= nowMs)
    .toSorted((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime())[0] ?? null;
}

export function deadlineTone(agenda: Agenda, nowMs: number): "urgent" | "soon" | "standard" {
  const hours = (new Date(agenda.deadline).getTime() - nowMs) / 3_600_000;
  return hours <= 24 ? "urgent" : hours <= 168 ? "soon" : "standard";
}
```

- [ ] **Step 4: Run the focused test and commit**

Run: `pnpm test:node -- tests/dashboard-presentation.test.mjs`

Expected: PASS.

```bash
git add app/dashboard/presentation.ts tests/dashboard-presentation.test.mjs
git commit -m "feat: add command center deadline priority helpers"
```

## Task 2: Build responsive Command Center navigation and Up-next strip

**Files:**
- Create: `app/dashboard/AppNavigation.tsx`
- Create: `app/dashboard/UpNext.tsx`
- Modify: `app/Dashboard.tsx`
- Modify: `app/dashboard/DashboardView.tsx`
- Modify: `tests/dashboard-accessibility.test.tsx`

**Interfaces:**
- Consumes: `AppView`, `Agenda`, profile role/name/email, and the pure helpers from Task 1.
- Produces: `<AppNavigation view={view} setView={setView} profile={profile} reviewCount={reviews.length} proposalCount={proposals.length} />` and `<UpNext agenda={agenda} nowMs={nowMs} expanded={expanded.includes(agenda.id)} onToggle={toggleAgenda} />`.

- [ ] **Step 1: Write failing accessibility tests**

```tsx
render(<AppNavigation view="dashboard" setView={() => {}} profile={profile} reviewCount={2} proposalCount={0} />);
expect(screen.getByRole("navigation", { name: "Primary navigation" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: /deadline runway/i })).toHaveAttribute("aria-current", "page");

render(<UpNext agenda={agenda} nowMs={Date.now()} expanded={false} onToggle={() => {}} />);
expect(screen.getByRole("button", { name: /open task/i })).toHaveAttribute("aria-expanded", "false");
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `pnpm test:tsx -- tests/dashboard-accessibility.test.tsx`

Expected: FAIL because the Command Center components do not exist.

- [ ] **Step 3: Implement presentational components and compose them**

- Move the current role-filtered `navItems` rendering from `Dashboard.tsx` into `AppNavigation`; use the same view IDs and labels so no route/action contract changes.
- Make desktop navigation an `<aside>` and mobile navigation a semantic `<nav>` with the same buttons. Keep privacy/account access available on mobile.
- In `Dashboard`, calculate `const upNext = selectUpNext(visibleAgendas, nowMs)` and pass it to `DashboardView`; retain all existing mutation callbacks unchanged.
- Render `UpNext` before the category tabs. Its button calls `onToggle(agenda.id)`, shows category, title, countdown, date, and `deadlineTone`, and uses an accessible name such as `Open task: ${agenda.title}`.
- Keep the existing task list. Do not duplicate task detail controls in Up-next.

- [ ] **Step 4: Run focused tests and commit**

Run: `pnpm test:tsx -- tests/dashboard-accessibility.test.tsx && pnpm test:node -- tests/dashboard-presentation.test.mjs`

Expected: PASS.

```bash
git add app/Dashboard.tsx app/dashboard/AppNavigation.tsx app/dashboard/UpNext.tsx app/dashboard/DashboardView.tsx tests/dashboard-accessibility.test.tsx
git commit -m "feat: add command center navigation and next deadline"
```

## Task 3: Replace editorial styling with the Command Center visual system

**Files:**
- Modify: `app/globals.css`
- Modify: `app/dashboard/DashboardView.tsx`
- Modify: `app/dashboard/ReviewView.tsx`
- Modify: `app/dashboard/ModeratorView.tsx`
- Modify: `app/dashboard/PrivacyView.tsx`
- Modify: `app/AskKampusDrawer.tsx`
- Modify: `app/AskKampusLauncher.tsx`

**Interfaces:**
- Consumes: existing class names and unchanged action props.
- Produces: one consistent responsive style layer for dashboard, utility drawer, review/moderation/privacy views, and state feedback.

- [ ] **Step 1: Add visual-regression-ready component assertions**

```tsx
render(<DashboardView {...props} />);
expect(screen.getByRole("heading", { name: "Upcoming" })).toBeInTheDocument();
expect(screen.getByRole("button", { name: /add a private deadline/i })).toBeInTheDocument();
expect(screen.getByRole("tablist", { name: "Deadline category" })).toBeInTheDocument();
```

- [ ] **Step 2: Run the component test and verify it fails or captures the pre-redesign structure**

Run: `pnpm test:tsx -- tests/dashboard-accessibility.test.tsx`

Expected: Existing assertions pass; newly asserted Command Center labels fail until Task 2 markup is present.

- [ ] **Step 3: Implement Command Center CSS and targeted markup hooks**

- Replace root tokens with `--navy`, `--surface`, `--blue`, `--lime`, `--coral`, neutral text/line tokens, and category-specific CSS variables.
- Style `app-shell` as a navy utility rail and bright canvas; on widths below 760px hide the rail and show the fixed mobile bottom navigation with safe-area padding.
- Make `.up-next` a high-contrast primary strip, `.agenda-card` a compact bordered row, and `.urgency-*` colour-led but text-labelled. Do not use colour as the sole urgency signal.
- Convert save/error feedback into a compact top status region; preserve `role="status"` and error alerts.
- Restyle Ask Kampus as a navy/white utility drawer and the launcher as a strong utility action without changing dynamic import or streaming behaviour.
- Add `@media (prefers-reduced-motion: reduce)` to disable transitions and smooth scrolling for newly introduced motion.
- Ensure all button text remains at least `14px`, focus styles are electric blue with visible offset, and coral/lime text is never used on insufficient-contrast backgrounds.

- [ ] **Step 4: Run tests, lint, and a production build; then commit**

Run: `pnpm test && pnpm lint && pnpm build`

Expected: all commands PASS.

```bash
git add app/globals.css app/dashboard/DashboardView.tsx app/dashboard/ReviewView.tsx app/dashboard/ModeratorView.tsx app/dashboard/PrivacyView.tsx app/AskKampusDrawer.tsx app/AskKampusLauncher.tsx tests/dashboard-accessibility.test.tsx
git commit -m "feat: restyle kampus as command center"
```

## Task 4: Refresh login, verify responsive use, and publish preview

**Files:**
- Modify: `app/login/page.tsx`
- Modify: `app/login/GoogleSignInButton.tsx`
- Modify: `tests/dashboard-accessibility.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: current Google `signInWithOAuth` call and its `redirectTo`, `hd`, and `prompt` values.
- Produces: Command Center login styling/copy without changing OAuth behaviour, plus explicit manual verification instructions.

- [ ] **Step 1: Add the failing login semantic assertion**

```tsx
expect(screen.getByRole("button", { name: /continue with iimk google/i })).toBeEnabled();
expect(screen.getByText(/gmail access is optional/i)).toBeInTheDocument();
```

- [ ] **Step 2: Run the relevant test and verify it fails**

Run: `pnpm test:tsx -- tests/dashboard-accessibility.test.tsx`

Expected: FAIL until the visible sign-in label is updated.

- [ ] **Step 3: Implement login refresh without changing OAuth configuration**

- Use the Command Center login tokens and a concise product promise.
- Add a non-branded Google glyph with `aria-hidden="true"` inside the existing button; keep all sign-in state handling and `signInWithOAuth` arguments exact.
- Set visible CTA copy to `Continue with IIMK Google`; retain the separate Gmail-consent and exact-domain explanation.
- Add README manual checks for 390px mobile, desktop, keyboard-only navigation, reduced motion, Google sign-in redirect, dashboard mutation without reload, Gmail sync, and Ask Kampus drawer open/close.

- [ ] **Step 4: Run the complete release gate**

Run: `pnpm test && pnpm lint && pnpm build && pnpm audit --prod`

Expected: all commands PASS with no high-severity production findings.

- [ ] **Step 5: Perform manual browser checks and commit**

- At 390px and desktop width, confirm Up-next appears before task rows, category tabs work by arrow keys, quick-add opens without navigation, and the mobile bottom navigation does not cover content.
- With keyboard only, open and close Ask Kampus and existing dialogs; confirm focus returns to the trigger.
- Confirm Google sign-in still reaches the existing callback flow, Gmail connect/sync and task mutations have no reload, and Ask Kampus still starts only after Gmail connection.

```bash
git add app/login/page.tsx app/login/GoogleSignInButton.tsx tests/dashboard-accessibility.test.tsx README.md
git commit -m "feat: refresh command center login experience"
git push origin hardening/production-readiness
```

## Plan self-review

- **Spec coverage:** Task 1 provides deterministic priority logic; Task 2 provides desktop/mobile navigation and Up-next hierarchy; Task 3 covers visual tokens, dense task treatment, feedback, Ask Kampus, accessibility, and reduced motion; Task 4 covers login, responsive/manual checks, and preview publication.
- **Scope:** Database, APIs, Gmail, roles, privacy, and task behaviours are explicitly excluded, matching the approved visual-only scope.
- **Consistency:** `selectUpNext`, `deadlineTone`, `AppNavigation`, and `UpNext` are defined before use; they reuse the existing `Agenda` and `AppView` contracts.
- **No placeholders:** The plan contains no deferred implementation markers and every task has a focused verification command and commit boundary.
