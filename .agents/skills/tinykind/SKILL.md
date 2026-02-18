---
name: tinykind
description: "Run TinyKind as a local skill that creates gratitude notes, calls a hosted TinyKind API to generate unique landing page URLs, and prepares Gmail draft content. Use when asked to Send a TinyKind, Start TinyKind, or set TinyKind weekly reminders."
---

# TinyKind Skill (Local + Hosted API)

## Quick start
- Read `references/tinykind-mvp-spec.md` for non-negotiable MVP goals, flows, data model, AI behavior, and edge cases.
- Read `references/hosted-api-contract.md` for required hosted endpoint and response fields.
- Use `scripts/tinykind_send.py` for the default send flow.
- For weekly reminders on macOS, use `scripts/tinykind_schedule_reminder_macos.py`.
- Keep scope aligned to MVP goals; flag any request that drifts into non-goals.
- Prefer minimal friction, fast send flow, and mobile-first recipient experience.

## Workflow
- Map the request to spec sections and summarize the applicable constraints before implementing.
- Validate that sender flow stays within 60 seconds and avoids extra steps.
- For direct TinyKind note writing requests, output only a polished `body` by default; include a headline only if the user explicitly asks for one.
- Apply light editing only: fix typos/clarity, preserve tone/wording, and do not rewrite into formal or cliche language.
- Implement AI polish exactly as specified: preserve voice, no invented facts, and keep edits near-verbatim.
- Enforce message limits: body max 240 characters for default output; voice max 60 seconds.
- Keep privacy rules: no open tracking, no public sharing, 1:1 only, minimal PII.
- Ensure delete behavior: deleted messages 404, no open events table.
- On each TinyKind send request, create a new message record and a fresh unique slug URL; do not reuse existing landing links.
- Prefer hosted API endpoint `POST /api/send` to create the message + URL.
- Default sharing flow: use returned Gmail compose URL plus copyable email subject/body.
- Optional reaction notifications: pass sender email so recipient emoji reactions trigger an email to sender.
- If recipient contact is not an email address, leave Gmail `to` blank and let sender choose recipient in compose.
- When running the send flow, execute:
  - `python3 scripts/tinykind_send.py --from-name "<sender>" --notify-email "<sender_email_optional>" --to-name "<recipient>" --to-contact "<email_or_phone>" --body "<note>"`
- `TINYKIND_API_BASE_URL` must be set; `TINYKIND_API_KEY` is optional.
- `TINYKIND_SENDER_NOTIFY_EMAIL` can set a default sender notification email for local skill runs.
- For weekly reminders:
  - In Codex app, prefer a weekly automation at user-selected day/time with prompt text:
    - `Who do you feel grateful for this week? Let's tell them!`
  - For local macOS fallback, run:
    - `python3 scripts/tinykind_schedule_reminder_macos.py install --weekday sun --time 17:00`
- For recipient UX, implement the “Envelope Peel” unwrap animation and emoji-only reactions.
- For sender UX, include dashboard counts and recent list without read receipts.

## Output expectations
- Provide implementation steps or code changes that are directly grounded in the spec.
- Include acceptance checks and edge-case handling (voice length, resend on SMS failure, reaction overwrite).
- When a decision isn’t specified (e.g., backend choice), default to the spec suggestions and confirm with the user.

## Example triggers
- “Send a TinyKind”
- “Start TinyKind”
- “Set my TinyKind weekly reminder for Fridays at 4pm”
- “Help me build TinyKind MVP flows”
