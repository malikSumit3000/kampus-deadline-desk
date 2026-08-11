# Creator Badge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Sumit Malik’s creator credit prominent in the existing sidebar.

**Architecture:** Replace the small bottom attribution with a static saffron-accented badge immediately below the brand. The change is presentation-only and needs no new state, API, or database work.

**Tech Stack:** React, CSS, Next.js.

## Global Constraints

- Render `Built by Sumit Malik` and `Class of 2028` exactly.
- Preserve existing navigation, auth, and data behavior.
- Keep the mobile layout usable.

---

### Task 1: Replace the creator credit

**Files:**
- Modify: `app/Dashboard.tsx`
- Modify: `app/globals.css`

- [ ] **Step 1: Move the creator markup below the brand**

```tsx
<div className="creator-badge">
  <span>Built by</span>
  <strong>Sumit Malik</strong>
  <small>Class of 2028</small>
</div>
```

- [ ] **Step 2: Style it as a high-contrast sidebar badge**

```css
.creator-badge { border-left: 3px solid var(--saffron); background: rgba(229, 157, 40, 0.12); }
```

- [ ] **Step 3: Run verification**

Run: `pnpm lint && pnpm build`

Expected: both commands succeed.

### Task 2: Deploy production

**Files:**
- None

- [ ] **Step 1: Deploy**

Run: `vercel --prod`

Expected: Vercel reports a Ready production deployment.
