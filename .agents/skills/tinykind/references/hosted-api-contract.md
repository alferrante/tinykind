# TinyKind Hosted API Contract (Skill Mode)

The local skill calls your hosted TinyKind backend.

## Required endpoint

`POST /api/send`

## Request JSON

```json
{
  "senderName": "Angela",
  "senderNotifyEmail": "angela@example.com",
  "recipientName": "Andrew Hillis",
  "recipientContact": "andrew@example.com",
  "body": "Thanks for showing up this week.",
  "channel": "email"
}
```

## Expected response JSON

```json
{
  "messageUrl": "https://tinykind.yourdomain.com/t/abc123",
  "gmailComposeUrl": "https://mail.google.com/mail/?...",
  "emailSubject": "A TinyKind from Angela",
  "emailBody": "Hi Andrew Hillis,...",
  "sharePreview": "Thanks for showing up this week...."
}
```

The skill can still work if only `messageUrl` is returned, but Gmail draft/copy flow is best when all fields above are present.

`senderNotifyEmail` is optional. When provided, recipient emoji reactions can trigger sender notification emails.

## Auth

Optional bearer token:

- Set `TINYKIND_API_KEY` locally.
- Skill script sends `Authorization: Bearer <key>`.

## Env vars

- `TINYKIND_API_BASE_URL` (required)
- `TINYKIND_API_KEY` (optional)
