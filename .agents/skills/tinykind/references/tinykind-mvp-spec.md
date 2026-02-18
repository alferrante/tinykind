# TinyKind MVP Product Spec

## 0) MVP goals (must not drift)
- Lower activation energy to express appreciation (<= 60 seconds, minimal friction)
- Create a habit loop for the sender (repeat sending becomes easier + more rewarding)

### Non-goals (MVP)
- Social network / feed
- Read receipts / open tracking
- Public metrics or sharing
- Monetization complexity

## 1) Core user stories
### Sender
- Select a recipient (from contacts or manual entry).
- Record a voice note (max 60s) or type a text note (max 280-500 chars; choose one).
- Optionally request “Polish” (AI cleanup + formatting) without losing voice.
- Send the TinyKind as a link (SMS/iMessage first).
- See a private dashboard.
- Count of TinyKinds sent over time.
- List of sent notes with recipient and date.
- Recipient response emoji(s) if any.
- No read receipts / no open tracking.

### Recipient
- Open a mobile-first landing page without creating an account.
- Experience a short “unwrap” animation and then see/hear the note.
- Respond with a single emoji reaction (and optionally choose from a small set).
- Not be prompted to sign up.

## 2) Information architecture (MVP)
### Entities
- User (sender only)
- Recipient (name + phone/email)
- TinyKindMessage
- Reaction

## 3) End-to-end flow (MVP)
### 3.1 Sender flow
#### A) Onboarding (minimal)
- Screen: Welcome
- CTA: “Send your first TinyKind”
- Optional: “Enable notifications” (ask after first send is better)
- Auth
- Email magic link OR phone OTP
- Goal: fast login without passwords

#### B) Create TinyKind
##### Screen: Pick a person
- Search bar: “To:”
- Options:
- Import contacts (optional for MVP; can do manual entry first)
- Manual entry fields:
- Name (required)
- Phone number (required for SMS; support email later)

##### Screen: Create message
- Toggle: Voice | Text
- Voice:
- Record button
- Timer visible
- Hard stop at 60 seconds
- Playback + re-record
- Text:
- Single text box with character count
- Gentle starter placeholder: “I appreciate you because…”
- Soft helper chips (tap inserts):
- “for showing up”
- “for checking in”
- “for making this easier”
- “for being you”
- Polish step (optional but recommended default ON)
- Toggle: “Polish my note (keep it me)” (default ON)
- Subtext: “We’ll make it clearer + format it nicely. No changing meaning.”

##### Screen: Preview
- Preview of the landing experience with selected “unwrap style” (see section 6)
- Show headline + body text (AI formatted)
- Play voice (if voice provided)
- Buttons:
- “Send TinyKind”
- “Edit”
- “Change style” (optional; can randomize in MVP)

##### Screen: Send
- Default: SMS (Twilio or similar)
- Message template: “A TinyKind from {SenderName}” + short link
- After send: “Sent. That mattered.”
- Optional: “Send another” CTA

#### C) Sender dashboard
- Screen: Dashboard
- Top metric: “TinyKinds sent”
- This week / month / all-time
- Streaks optional, avoid guilt
- If used: “Weeks you’ve sent at least 1: X”
- List: recent TinyKinds (cards)
- Recipient name
- Date sent
- Short headline
- Reaction status (if any)
- “View” (opens the exact landing view)
- “New TinyKind” floating action button
- No open tracking
- Do not store open events
- If analytics needed, keep aggregated and not exposed to user

### 3.2 Recipient flow
#### Landing page (mobile-first)
- Loads fast, no login.
- Presents “unwrap” animation (one of three styles; see section 6)
- After animation, reveal:
- “From {SenderName}”
- Headline + body text
- If voice exists: big play button + waveform
- Reaction
- “Send a reaction” with 6-10 emoji options max:
- 💛 😊 😭 🥹 😌 🙏 🫶 ✨
- Tap emoji -> confirmation microcopy: “Sent to {SenderName}”
- Optional: allow exactly 1 reaction per recipient per message (enforced by cookie + lightweight token)
- Keep simple: allow multiple taps but store only latest reaction
- No reply thread
- MVP: emoji only (text replies later)

## 4) AI behavior spec (very specific)
### Inputs
- Sender raw text OR transcription of voice note
- Sender name (optional)
- Recipient name (optional)

### Outputs (store both)
- Polished headline (max 7 words)
- Polished body (max 240 chars; 1-2 sentences)
- Polished transcript (if voice; keep near-verbatim but remove filler)

### Constraints
- Preserve meaning and tone
- No new facts, no invented compliments
- No overly formal Hallmark language
- Keep it human and specific

### Example system prompt
“You are TinyKind’s note polisher. Your job is to preserve the sender’s voice while making the note clearer, warmer, and more specific. Do not add content or meaning. Do not exaggerate. Avoid clichés. Output JSON with fields: headline, body, cleaned_transcript (optional). Headline <= 7 words. Body <= 240 characters.”

### Transcription
- Use Whisper (or equivalent) for voice -> raw transcript
- Then run polish model on transcript

## 5) Data model (MVP)
### User
- id (uuid)
- name
- phone/email
- created_at

### Recipient
- id
- user_id (owner)
- name
- phone (or email)
- created_at
- last_sent_at

### TinyKindMessage
- id
- user_id
- recipient_id
- channel (sms/email)
- created_at
- raw_text (nullable)
- voice_url (nullable)
- voice_duration_seconds (nullable)
- transcript_raw (nullable)
- transcript_cleaned (nullable)
- headline (nullable)
- body (nullable)
- unwrap_style (enum: A/B/C)
- short_link_slug (unique)
- status (draft/sent)

### Reaction
- id
- message_id
- emoji
- created_at
- recipient_fingerprint (cookie hash or token; not PII)

Important: No open events table.

## 6) “Unwrapping” animation
### Goal
Make opening feel like a simple delightful animated moment.

### Style: “Envelope Peel”
- Metaphor: a sealed envelope that gently peels open.
- Recipient sees minimal envelope icon + “Tap to open”.
- On tap: paper edge peels back (CSS/SVG), then note slides up.
- Clean lines, light shadow, subtle sound optional (default off).
- Build approach: SVG envelope + CSS clip-path animation.

## 7) Habit loop mechanics (MVP)
### Triggers
- Weekly reminder notification (sender only)
- Copy: “Who made your week a little better?”
- Allow user to pick day/time later; MVP default Sunday 5pm local.

### Variable rewards (structured, non-gamified)
- Randomly choose 1 of 3 unwrap styles for each send (or user chooses)
- Occasionally show a private insight (1 in 4 sends):
- “You often appreciate people for showing up consistently.”

### Investment (makes next send easier)
- Recipient “People Cards” store last headline sent + top appreciation themes
- Next time user selects same recipient, show:
- “Last time you thanked them for: checking in.”
- One-tap prompt starter: “This week I appreciated you for…”
- MVP version: just show last headline; theme tags can be v1.1

## 8) Notifications + scheduling (MVP)
- Weekly prompt to sender (push if mobile web supports; email fallback)
- If recipient reacts, sender gets notification: “{Name} reacted 💛”
- No mention of “opened”.

## 9) Privacy / safety / tone requirements
- Default: private, 1:1
- No public profiles
- No sharing feed
- Store minimal PII (phone/email only for sending)
- If user deletes a message, landing should 404

## 10) Tech implementation notes (suggested)
- Frontend: Next.js / React, Tailwind
- Backend: Supabase or Firebase (auth + DB + storage)
- SMS: Twilio
- Short links: your domain + slug; resolve to landing route
- Storage: voice files in S3/Supabase Storage
- AI: OpenAI (transcribe + polish), or Whisper + LLM

## 11) Edge cases
- Voice longer than 60s -> hard stop and prompt to re-record
- Recipient opens link on desktop -> show mobile card centered
- Recipient taps reaction multiple times -> store latest
- Sender sends to same phone with different name -> MVP keep separate by recipient_id; match by phone on create
- Failed SMS delivery -> show error, allow resend

## 12) Screen list (for builders)
- Welcome / Auth
- Pick recipient
- Compose (voice/text)
- Preview (unwrap style)
- Send confirmation
- Dashboard (stats + list)
- Message detail (view what you sent + reaction)
- Recipient pages: Landing (unwrap + message)
- Reaction confirmation micro-state
