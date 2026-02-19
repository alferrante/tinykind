# TinyKind

TinyKind lets a sender write a short gratitude note, generates a unique landing page URL, and prepares Gmail-ready content for sending.

## Local Run

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

## Use As A Local Skill (Codex)

The TinyKind skill lives at:

- `.agents/skills/tinykind/SKILL.md`

To use it locally in Codex, you can either:

1. Clone this repo and run inside it (Codex will discover `.agents/skills/tinykind`), or
2. Copy the skill folder into your global skills directory:

```bash
mkdir -p ~/.codex/skills
cp -R .agents/skills/tinykind ~/.codex/skills/tinykind
```

The skill send script is:

- `.agents/skills/tinykind/scripts/tinykind_send.py`

Example:

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

See `.env.example`.

## Deploy

Render Blueprint config is included at `render.yaml`.

Full steps: `DEPLOYMENT.md`.
