# TinyKind Deployment Guide

This app creates a unique live URL for every TinyKind (`/t/<slug>`) and returns Gmail-ready send content.

## 1. Push To GitHub

Run in `/Users/zapierangelaferrante/TinyKind`:

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

## 3. Render Environment Variables

Set these in Render service settings:

- `NEXT_PUBLIC_BASE_URL=https://tinykind.app` (or your chosen production URL)
- `TINYKIND_DATA_DIR=/var/data`

The live store file is `/var/data/tinykind.json`.

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

## 6. Current MVP Limits

- JSON file storage on one persistent disk.
- No sender auth yet.
- No direct email sending provider yet (Gmail compose is current flow).
