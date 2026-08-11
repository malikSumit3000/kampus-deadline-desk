# Manual No-Credit Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let students maintain private deadlines and a moderator publish verified shared deadlines without requiring an Anthropic API balance.

**Architecture:** Add one validated, authenticated endpoint for private manual agendas and one role-gated endpoint for shared agendas. The dashboard gets two small input forms. A feature flag stops Gmail sync before it invokes Anthropic, returning a clear paused state instead of an extraction failure.

**Tech Stack:** Next.js App Router, React, Supabase RLS, Node test runner, TypeScript.

## Global Constraints

- Student-created records must always be private and associated with the authenticated user.
- Shared records require the existing `moderator` role and are immediately marked approved.
- Never send Gmail content to Anthropic while `ENABLE_AI_EXTRACTION` is not exactly `true`.
- Preserve the existing Google-only authentication and Gmail read-only connection behavior.

---

### Task 1: Validate manual deadline payloads

**Files:**
- Create: `lib/manual-deadlines.ts`
- Create: `tests/manual-deadlines.test.mjs`

**Interfaces:**
- Produces `parseManualDeadline(input)` returning `{ title, category, detail, deadline }` or `null`.

- [ ] **Step 1: Write the failing test**

```js
assert.deepEqual(parseManualDeadline({
  title: "Submit résumé",
  category: "Placements",
  deadline: "2026-08-20T18:00",
  detail: "Upload the final PDF",
}), {
  title: "Submit résumé",
  category: "Placements",
  deadline: "2026-08-20T18:00:00+05:30",
  detail: "Upload the final PDF",
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test -- tests/manual-deadlines.test.mjs`

Expected: FAIL because `parseManualDeadline` does not exist.

- [ ] **Step 3: Write minimal implementation**

```ts
export function parseManualDeadline(input: unknown) {
  // Reject invalid title/category/date and normalize a datetime-local value to Asia/Kolkata.
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test -- tests/manual-deadlines.test.mjs`

Expected: PASS.

### Task 2: Create secure manual-deadline APIs

**Files:**
- Create: `app/api/manual-deadlines/route.ts`
- Create: `app/api/moderator/manual-agendas/route.ts`
- Modify: `app/api/gmail/sync/route.ts`

**Interfaces:**
- `POST /api/manual-deadlines` creates one `private_agendas` row for the signed-in user.
- `POST /api/moderator/manual-agendas` creates an approved `agendas` row plus an `agenda_stages` row for a moderator only.
- Gmail sync returns HTTP 503 with `error: "AI extraction is paused."` before email content is fetched when the feature flag is off.

- [ ] **Step 1: Use `parseManualDeadline` in both APIs**

```ts
const item = parseManualDeadline(await request.json());
if (!item) return NextResponse.json({ error: "Invalid deadline" }, { status: 400 });
```

- [ ] **Step 2: Enforce identity and moderator checks before inserts**

```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

- [ ] **Step 3: Pause sync before scanning mail**

```ts
if (process.env.ENABLE_AI_EXTRACTION !== "true") {
  return NextResponse.json({ error: "AI extraction is paused." }, { status: 503 });
}
```

### Task 3: Add dashboard forms and truthful status copy

**Files:**
- Modify: `app/Dashboard.tsx`
- Modify: `README.md`
- Modify: `.env.example`

**Interfaces:**
- Students can submit a private manual deadline from the dashboard.
- Moderators can submit a verified shared deadline from the moderator view.
- The Gmail section says extraction is paused until AI is enabled.

- [ ] **Step 1: Add dashboard state and submit handlers**

```tsx
const response = await fetch("/api/manual-deadlines", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ title, category, deadline, detail }),
});
```

- [ ] **Step 2: Render a private form for every user and a shared form only for moderators**

```tsx
<form onSubmit={submitManualDeadline}>
  <input name="title" required />
  <input name="deadline" type="datetime-local" required />
  <button type="submit">Add private deadline</button>
</form>
```

- [ ] **Step 3: Document `ENABLE_AI_EXTRACTION=false` as the deployment default**

### Task 4: Verify the implementation

**Files:**
- Test: `tests/*.test.mjs`

- [ ] **Step 1: Run unit tests**

Run: `pnpm test`

Expected: all tests pass.

- [ ] **Step 2: Run lint and production build**

Run: `pnpm lint && pnpm build`

Expected: both exit successfully.

- [ ] **Step 3: Update the Vercel environment with `ENABLE_AI_EXTRACTION=false`, deploy, and perform a live signed-in smoke test**

Run: `vercel env add ENABLE_AI_EXTRACTION production preview` then `vercel --prod`.

Expected: manual add forms work and Gmail sync reports paused rather than invoking Anthropic.
