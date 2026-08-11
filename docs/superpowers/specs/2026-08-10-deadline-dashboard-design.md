# Personal Gmail Deadline Dashboard — Design (archived frontend prototype)

> Historical document. The current Vercel/Supabase implementation is documented in the repository README.

## Goal

Create a responsive, dashboard-first pilot experience for IIMK students that makes new deadlines easy to scan, prioritise, review, and track while making privacy boundaries explicit. This release is a realistic interactive prototype with synthetic data. It must not imply that live Gmail, Supabase, Anthropic, or institutional OAuth connections are active.

## Experience

The primary view is a single workspace rather than a marketing landing page. A compact navigation rail identifies the product and exposes Dashboard, Review inbox, Moderator, and Privacy surfaces. The main column opens with Gmail connection health and the deadline runway, followed by category tabs for All, Case Comps, Committees, Placements, and Academics.

Agenda cards are ordered by urgency. Each card shows its shared or private classification, deadline countdown, status, source, and expandable stages. Students can change a stage between to-do, in progress, and submitted, and can add a private date. Interactions update the visible prototype state for the current session only.

The private review inbox supports approve, correct, dismiss, and open-in-Gmail affordances. The moderator surface shows proposal diffs and actions for merge, edit-and-approve, reject, and mark-private. The privacy surface explains read-only Gmail scope, new-mail-only processing, provider retention, token revocation, export, and account deletion.

## Visual Direction

Use an editorial academic aesthetic with warm ivory surfaces, deep ink typography, forest green for trusted/connected states, and saffron or coral only for urgency. Strong typography, whitespace, rules, badges, and CSS shapes carry the visual identity; decorative stock imagery is unnecessary. Shared records use neutral cards, while private records use a clearly labelled tinted treatment.

The first viewport prioritises the actual product: sync health, near-term deadlines, and the next action. Dense operational information should remain readable through hierarchy rather than generic dashboard chrome. Mobile layouts collapse navigation and stack controls without hiding primary actions.

## Product Boundaries

- All displayed mail, people, deadlines, model spend, and audit events are synthetic.
- No raw email body or attachment content is represented as stored data.
- Live OAuth, Gmail ingestion, Supabase persistence, encryption, and Anthropic extraction require credentials, approved infrastructure, and institutional review; the prototype communicates these as configuration requirements.
- Progress and corrections are demonstrative UI state, not durable records.
- No email, browser, or push notifications are included.

## Accessibility and Error States

All controls have accessible names, visible focus styles, keyboard operation, and WCAG-oriented contrast. Sync failures, stale data, expired test-mode consent, conflicts, and uncertain attachments are presented as explicit states rather than silent omissions. Reduced-motion preferences disable non-essential animation.

## Validation

Automated checks cover presence of the core product sections and privacy disclosures. The deployment build must succeed. The finished site metadata and social preview must match the product, and starter preview assets must be removed.
