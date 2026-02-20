# TinyKind

TinyKind lets a sender write a short gratitude note, generates a unique landing page URL, and prepares Gmail-ready content for sending.

## Read This First

This repository contains **two things**:

1. **Web app** (Next.js app in `src/`)  
2. **Codex skill** (only this folder): `.agents/skills/tinykind`

If you  want to use TinyKind as a skill in a coding agent, you only need `.agents/skills/tinykind`.
If you  want the app experience, use the hosted web app.

## Hosted Web App (No Local Setup)

Use TinyKind on the hosted site:

- [https://tinykind.app](https://tinykind.app)
- Fallback: [https://tinykind-web.onrender.com](https://tinykind-web.onrender.com)

## Skill-Only Install (No App Setup)

Copy only the skill folder into your Codex skills directory:

```bash
mkdir -p ~/.codex/skills
cp -R .agents/skills/tinykind ~/.codex/skills/tinykind
```

If you want to download only the skill path from GitHub (instead of full app code), use sparse checkout:

```bash
git clone --filter=blob:none --no-checkout https://github.com/alferrante/tinykind.git
cd tinykind
git sparse-checkout init --cone
git sparse-checkout set .agents/skills/tinykind
git checkout main
```

## Use As A Local Skill (Codex)

Main skill file:

- `.agents/skills/tinykind/SKILL.md`

Send script:

- `.agents/skills/tinykind/scripts/tinykind_send.py`

Example run:

```bash
python3 .agents/skills/tinykind/scripts/tinykind_send.py \
  --api-base-url https://tinykind-web.onrender.com \
  --from-name "Your Name" \
  --notify-email "you@example.com" \
  --to-name "Recipient Name" \
  --to-contact "recipient@example.com" \
  --body "Thanks for showing up this week."
```

## Weekly Reminder Automation (Skill Mode)

Automation is supported, but it is **not auto-created** by default.

Options:

- Codex automation: create a weekly automation with prompt  
  `Who do you feel grateful for this week? Let's tell them!`
- macOS fallback: use  
  `.agents/skills/tinykind/scripts/tinykind_schedule_reminder_macos.py`

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
- `RESEND_API_KEY` - optional, sends sender email notifications on reactions.
- `TINYKIND_REACTION_FROM_EMAIL` - optional, required with `RESEND_API_KEY`.
- `TINYKIND_ADMIN_TOKEN` - optional, protects admin/debug APIs (`/api/messages*`).
- `ADMIN_PASSWORD` - optional but recommended, enables browser admin login at `/admin`.

## Admin Access (Private)

- Login page: `/admin/login`
- Admin submissions view: `/admin`
- Keep this private by setting `ADMIN_PASSWORD` in Render env vars.
- For script/API access, you can still use `TINYKIND_ADMIN_TOKEN`.

See `.env.example`.

## Deploy

Render Blueprint config is included at `render.yaml`.

Full steps: `DEPLOYMENT.md`.

## Roadmap

See `ROADMAP.md` for planned features and sequencing.
