# Personal Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore normal Gmail extraction behavior and let each student create private categories and move any deadline into one without changing the shared record for other students.

**Architecture:** Store a student-specific category alongside the existing private deadline override record for shared stages; store category directly on private agendas. The dashboard merges these overrides on load and exposes a per-deadline category selector plus a custom-name entry. Gmail sync no longer checks an AI feature flag.

**Tech Stack:** Next.js App Router, React, Supabase Postgres/RLS, Node test runner, TypeScript.

## Global Constraints

- A custom category is private to the student who creates it.
- Moving a shared deadline must never mutate `public.agendas.category` or affect another student.
- Gmail sync must keep its existing confidence/privacy policy and may fail when the Anthropic account has no credit.
- Existing standard categories remain available.

---

### Task 1: Add tested category validation

**Files:**
- Modify: `lib/manual-deadlines.ts`
- Modify: `tests/manual-deadlines.test.mjs`

**Interfaces:**
- Produces `parsePersonalCategory(input)` returning a trimmed category up to 60 characters or `null`.

- [ ] **Step 1: Write the failing test**

```js
assert.equal(parsePersonalCategory("  Internship applications  "), "Internship applications");
assert.equal(parsePersonalCategory(""), null);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`

Expected: FAIL because `parsePersonalCategory` does not exist.

- [ ] **Step 3: Implement the minimal parser**

```ts
export function parsePersonalCategory(input: unknown) {
  return typeof input === "string" && input.trim().length > 0 && input.trim().length <= 60
    ? input.trim()
    : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`

Expected: PASS.

### Task 2: Persist personal category moves

**Files:**
- Create: `supabase/migrations/202608110002_personal_category_overrides.sql`
- Modify: `app/api/private-dates/route.ts`
- Modify: `lib/dashboard/load-dashboard.ts`

**Interfaces:**
- Migration adds nullable `category text` to `private_deadline_overrides`.
- `PUT /api/private-dates` accepts `{ stageId, deadline?, category? }`.
- Dashboard returns `privateCategories: Record<string, string>`.

- [ ] **Step 1: Add the migration**

```sql
alter table public.private_deadline_overrides add column if not exists category text;
```

- [ ] **Step 2: Upsert shared-stage date/category overlays and update private agendas directly**

```ts
supabase.from("private_deadline_overrides").upsert({ user_id: user.id, stage_id, deadline, category });
```

- [ ] **Step 3: Merge the category overlay only into the signed-in user’s loaded agenda data**

### Task 3: Render and use custom categories

**Files:**
- Modify: `app/dashboard-data.ts`
- Modify: `app/Dashboard.tsx`
- Modify: `app/globals.css`
- Modify: `README.md`

**Interfaces:**
- A category filter includes personal custom categories.
- Each deadline stage has a personal category selector and an “Add custom category” action.
- Moving an item persists it and refreshes the dashboard.

- [ ] **Step 1: Remove `ENABLE_AI_EXTRACTION` UI and feature-flag data**

```tsx
<button className="button secondary" onClick={refreshInbox} disabled={syncing}>Refresh inbox</button>
```

- [ ] **Step 2: Add category selection controls for each stage**

```tsx
<select value={category} onChange={(event) => updatePersonalCategory(stage.id, event.target.value)}>
  {availableCategories.map((category) => <option key={category}>{category}</option>)}
</select>
```

- [ ] **Step 3: Add a custom category entry with the same validator and submit it as the stage’s personal category**

### Task 4: Verify and deploy

**Files:**
- Test: `tests/*.test.mjs`

- [ ] **Step 1: Run `pnpm test`, `pnpm lint`, and `pnpm build`**
- [ ] **Step 2: Run the migration in Supabase SQL Editor**
- [ ] **Step 3: Remove `ENABLE_AI_EXTRACTION` from Vercel and deploy production**
