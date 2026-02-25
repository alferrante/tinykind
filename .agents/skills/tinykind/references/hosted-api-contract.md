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
  "recipientEmail": "andrew@example.com",
  "body": "Thanks for showing up this week.",
  "deliveryMode": "email"
}
```

## Expected response JSON

```json
{
  "messageUrl": "https://tinykind.yourdomain.com/t/abc123",
  "deliveryMode": "email",
  "gmailComposeUrl": "https://mail.google.com/mail/?... or null in link mode",
  "emailSubject": "A TinyKind from Angela",
  "emailBody": "You've received a TinyKind from Angela: https://tinykind.yourdomain.com/t/abc123",
  "sharePreview": "You've received a TinyKind from Angela: https://tinykind.yourdomain.com/t/abc123"
}
```

The skill can still work if only `messageUrl` is returned, but Gmail draft/copy flow is best when all fields above are present.

`senderNotifyEmail` is optional. When provided, recipient emoji reactions can trigger sender notification emails.
Open/access notifications are controlled by server env var `OPEN_NOTIFY_ENABLED`.

## Auth

Optional bearer token:

- Set `TINYKIND_API_KEY` locally.
- Skill script sends `Authorization: Bearer <key>`.

## Env vars

- `TINYKIND_API_BASE_URL` (required)
- `TINYKIND_API_KEY` (optional)
