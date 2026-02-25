# TinyKind Deployment Guide

This app creates a unique live URL for every TinyKind (`/t/<slug>`) and returns Gmail-ready send content.

## 1. Push To GitHub

Run in your project root:

```bash
git init
git add .
git commit -m "Initial TinyKind MVP"
git branch -M main
git remote add origin <YOUR_GITHUB_REPO_URL>
git push -u origin main
```

Use an empty repo URL, for example:
- `git@github.com:<org-or-user>/tinykind.git` (SSH)
- `https://github.com/<org-or-user>/tinykind.git` (HTTPS)

## 2. Deploy On Render (Blueprint)

`render.yaml` is included in the repo. In Render:

1. Open your new Web Service.
2. Connect the GitHub repo.
3. Choose **Use Blueprint (`render.yaml`)**.
4. Confirm the service + disk are created.

`render.yaml` config:
- Node web service
- build: `npm ci && npm run build`
- start: `npm run start -- --port $PORT`
- persistent disk at `/var/data`
- cron backup job every 6 hours (`tinykind-backup`)
- cron reminder runner every 15 minutes (`tinykind-weekly-reminders`)

## 3. Render Environment Variables

Set these in Render service settings:

- `NEXT_PUBLIC_BASE_URL=https://tinykind.app` (or your chosen production URL)
- `TINYKIND_DATA_DIR=/var/data`
- `TINYKIND_BACKUP_DIR=/var/data/backups`
- `TINYKIND_BACKUP_ON_WRITE=1`
- `TINYKIND_BACKUP_RETENTION_DAYS=30`
- `TINYKIND_BACKUP_MAX_FILES=400`
- `TINYKIND_ADMIN_TOKEN=<random-long-secret>` (protects admin/debug message APIs)
- `ADMIN_PASSWORD=<strong-admin-password>` (enables private `/admin` browser login)
- `TINYKIND_AUTH_SECRET=<long-random-secret>` (sender magic-link login signing)
- `GOOGLE_CLIENT_ID=<google-oauth-client-id>` (optional, enables Google sign-in)
- `GOOGLE_CLIENT_SECRET=<google-oauth-client-secret>` (optional, enables Google sign-in)
- `GOOGLE_REDIRECT_URI=https://tinykind.app/api/auth/google/callback` (optional override)
- `TINYKIND_CRON_TOKEN=<random-long-secret>` (authorizes reminder cron calls)
- `OPEN_NOTIFY_ENABLED=0` (set to `1` when ready to email sender on recipient open)
- `RESEND_API_KEY=<resend-api-key>` (optional, enables sender reaction notification emails)
- `TINYKIND_REACTION_FROM_EMAIL="TinyKind <reactions@tinykind.app>"` (optional, required with `RESEND_API_KEY`)

The live store file is `/var/data/tinykind.json`.
Backups are saved under `/var/data/backups`.

## 4. Connect `tinykind.app` (Namecheap)

In Render service settings, add custom domains:
- `tinykind.app`
- `www.tinykind.app` (optional but recommended)

Render will show exact DNS targets. In Namecheap DNS:

1. For `www`, create `CNAME` to the Render target.
2. For apex (`@`), create the record type Render asks for (usually `A`/`ALIAS`).
3. Remove conflicting old `A`/`CNAME` records for `@`/`www`.

Wait for DNS + SSL provisioning, then verify both:
- `https://tinykind.app`
- `https://www.tinykind.app` (if configured)

## 5. Production Smoke Test

1. Open home page and create a TinyKind.
2. Verify response includes:
   - live landing URL
   - Gmail compose URL
   - copyable subject/body/link
3. Open the generated `/t/<slug>` URL in an incognito browser.
4. React with emoji and verify state updates.
5. If sender provided an email, verify reaction notification email arrives.
6. Verify admin login:
   - Open `/admin/login`
   - Sign in with `ADMIN_PASSWORD`
   - Confirm recent submissions render in `/admin`
7. Verify sender login + dashboard:
   - Open `/login`
   - Sign in with Google (if configured) or request magic link and sign in
   - Confirm `/dashboard` shows sender history and reminder settings
8. Verify recipient-open notifications (when `OPEN_NOTIFY_ENABLED=1`):
   - Open a `/t/<slug>` link as recipient
   - Confirm sender receives an open notification email
   - Re-open within 30 minutes and confirm no duplicate open-notification email
9. In `/admin`, click **Backup now** and confirm backups count increases.

## 6. Current MVP Limits

- JSON file storage on one persistent disk.
- Backups are on the same disk (not yet offsite/object-storage backups).
- Requires explicit sender click to send from Gmail draft (app does not auto-send outbound TinyKind emails yet).
