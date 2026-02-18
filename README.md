# TinyKind

TinyKind lets a sender write a short gratitude note, generates a unique landing page URL, and prepares Gmail-ready content for sending.

## Local Run

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Core Flow

1. Create a TinyKind note from `/`.
2. App stores note and creates unique URL at `/t/<slug>`.
3. Sender gets:
   - landing page URL
   - Gmail compose URL
   - copyable email subject/body/link

## Key Environment Variables

- `NEXT_PUBLIC_BASE_URL` - absolute app URL used in generated links.
- `TINYKIND_DATA_DIR` - directory for JSON storage (`tinykind.json`).

See `.env.example`.

## Deploy

Render Blueprint config is included at `render.yaml`.

Full steps: `DEPLOYMENT.md`.
