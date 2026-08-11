# Kampus Deadline Desk

Personal deadline dashboards for IIMK students. This repository is the Vercel/Supabase migration of the original Sites frontend.

## What is implemented

- Google-only Supabase Auth with an exact `@iimk.ac.in` server-side check
- a separate, optional Google consent flow for `gmail.readonly`
- encrypted Gmail refresh tokens, held only in server-only tables
- shared approved agendas plus per-student progress, private dates, private agendas, and review inboxes
- moderator-gated shared-fact proposals
- bounded Gmail scanning and Anthropic deadline extraction with confidence/privacy gates
- manual private deadlines for every student and manual verified shared deadlines for moderators
- export, Gmail disconnect/token revocation, sign-out, and account deletion

Raw Gmail bodies and attachments are not stored. A SHA-256 content fingerprint and minimal processing receipt are retained so a message is not processed twice.

## Local verification

Requires Node.js 22.13+ and pnpm.

```bash
pnpm install
cp .env.example .env.local
pnpm test
pnpm lint
pnpm build
pnpm dev
```

## 1. Create Supabase

1. Create a Supabase project.
2. Apply every file in `supabase/migrations/` in filename order.
3. `supabase/seed.sql` is intentionally empty. Add verified batch deadlines only through a moderator account.
4. In Authentication → URL Configuration, set the Site URL to the final Vercel URL and allow `http://localhost:3000/auth/callback` and `https://YOUR_DOMAIN/auth/callback`.
5. Enable only the Google provider in Supabase Auth.

Keep `SUPABASE_SERVICE_ROLE_KEY` server-side. Never prefix it with `NEXT_PUBLIC_`.

## 2. Configure Google Cloud

Use an IIMK-owned Google Cloud project if possible. The Workspace administrator may need to approve the app and Gmail scope.

Configure an OAuth web client with these redirect URIs:

- `https://YOUR_SUPABASE_PROJECT.supabase.co/auth/v1/callback` for website identity
- `http://localhost:3000/api/gmail/callback` for local Gmail connection
- `https://YOUR_DOMAIN/api/gmail/callback` for production Gmail connection

Website identity uses basic Google identity through Supabase. Inbox access is requested later and separately using only `https://www.googleapis.com/auth/gmail.readonly` plus email verification.

If the Google app remains in testing mode, add each pilot student as a test user. For a batch-wide launch, complete the relevant Workspace admin and Google OAuth verification steps.

## 3. Configure Anthropic

Create an API key and set `ANTHROPIC_MODEL` to the model ID approved for this deployment. The extractor sends at most 12,000 characters of plain-text message content and requests structured JSON. Sensitive-looking rosters, shortlists, CVs, grades, and similar content bypass model extraction and enter the private review queue.

Without prepaid API credits, Gmail extraction requests will fail. Gmail connection, private manual deadlines, and moderator-managed shared deadlines remain available.

## 4. Environment variables

Copy every key from `.env.example` into Vercel Project Settings → Environment Variables. Generate the encryption key once:

```bash
openssl rand -base64 32
```

Changing `TOKEN_ENCRYPTION_KEY` after users connect makes existing Gmail credentials unreadable; disconnect those accounts before rotating it.

## 5. Deploy to Vercel

Connect the private GitHub repository to the existing Vercel project. Pull requests create previews; only the protected `main` branch should promote to production.

After the final domain is known, update the Supabase allowlist and Google redirect URI, then redeploy.

## 6. Choose the moderator

After the moderator signs in once, promote that exact profile in Supabase SQL:

```sql
update public.profiles
set role = 'moderator'
where email = 'MODERATOR@iimk.ac.in';
```

Do not expose a browser route that can change roles.

## Pilot acceptance checks

1. A personal Gmail address is rejected.
2. An IIMK Google account can sign in without granting Gmail access.
3. Connect Gmail shows only the read-only scope and the same signed-in IIMK account.
4. Student A cannot read Student B's progress, dates, reviews, or private agendas.
5. A low-confidence or sensitive message enters only that student's review inbox.
6. Shared extracted facts remain proposals until a moderator decides.
7. Disconnect Gmail revokes the Google grant and removes the encrypted credential.
8. Delete account removes the Supabase Auth user and all private rows through cascading foreign keys.

## Important production boundary

The code and production build are complete, but a live deployment still requires your Supabase project, Google OAuth client/admin approval, Anthropic key, Vercel project, and final domain. Those credentials are deliberately not included in this repository.
