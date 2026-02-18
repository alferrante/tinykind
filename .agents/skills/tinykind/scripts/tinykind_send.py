#!/usr/bin/env python3
"""Create a TinyKind via hosted API and return share-ready outputs."""

from __future__ import annotations

import argparse
import json
import os
import sys
import textwrap
import urllib.error
import urllib.parse
import urllib.request
import webbrowser
from typing import Any


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create a TinyKind using a hosted TinyKind API endpoint."
    )
    parser.add_argument(
        "--api-base-url",
        default=os.environ.get("TINYKIND_API_BASE_URL", "").strip(),
        help="Base URL for TinyKind API, e.g. https://tinykind.example.com",
    )
    parser.add_argument(
        "--api-key",
        default=os.environ.get("TINYKIND_API_KEY", "").strip(),
        help="Optional API key sent as Authorization: Bearer <key>",
    )
    parser.add_argument("--from-name", required=True, help="Sender name")
    parser.add_argument(
        "--notify-email",
        default=os.environ.get("TINYKIND_SENDER_NOTIFY_EMAIL", "").strip(),
        help="Optional sender email to receive recipient reaction notifications",
    )
    parser.add_argument("--to-name", required=True, help="Recipient display name")
    parser.add_argument(
        "--to-contact",
        required=True,
        help="Recipient contact (email preferred for Gmail draft)",
    )
    parser.add_argument("--body", required=True, help="TinyKind body text")
    parser.add_argument(
        "--channel",
        default="email",
        choices=["email", "sms"],
        help="Channel recorded by API",
    )
    parser.add_argument(
        "--open-gmail",
        action="store_true",
        help="Open returned gmailComposeUrl in default browser",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print raw JSON response only",
    )
    return parser.parse_args()


def post_send(
    *,
    api_base_url: str,
    api_key: str,
    from_name: str,
    notify_email: str,
    to_name: str,
    to_contact: str,
    body: str,
    channel: str,
) -> dict[str, Any]:
    send_url = urllib.parse.urljoin(api_base_url.rstrip("/") + "/", "api/send")
    payload = {
        "senderName": from_name,
        "senderNotifyEmail": notify_email or None,
        "recipientName": to_name,
        "recipientContact": to_contact,
        "body": body,
        "channel": channel,
    }
    encoded = json.dumps(payload).encode("utf-8")
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    req = urllib.request.Request(send_url, data=encoded, headers=headers, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw)
    except urllib.error.HTTPError as err:
        details = err.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"API request failed ({err.code}): {details}") from err
    except urllib.error.URLError as err:
        raise RuntimeError(f"Could not reach TinyKind API: {err.reason}") from err


def print_human(payload: dict[str, Any]) -> None:
    message_url = payload.get("messageUrl", "")
    gmail_url = payload.get("gmailComposeUrl", "")
    subject = payload.get("emailSubject", "")
    email_body = payload.get("emailBody", "")

    print("TinyKind created.")
    if message_url:
        print(f"Landing URL: {message_url}")
    if gmail_url:
        print(f"Gmail draft: {gmail_url}")
    if subject:
        print("\nEmail subject:\n")
        print(subject)
    if email_body:
        print("\nEmail body:\n")
        print(email_body)


def main() -> int:
    args = parse_args()
    if not args.api_base_url:
        print(
            textwrap.dedent(
                """
                Missing API base URL.
                Set TINYKIND_API_BASE_URL or pass --api-base-url.
                Example: --api-base-url https://tinykind.example.com
                """
            ).strip(),
            file=sys.stderr,
        )
        return 2

    payload = post_send(
        api_base_url=args.api_base_url,
        api_key=args.api_key,
        from_name=args.from_name,
        notify_email=args.notify_email,
        to_name=args.to_name,
        to_contact=args.to_contact,
        body=args.body,
        channel=args.channel,
    )

    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        print_human(payload)

    gmail_url = payload.get("gmailComposeUrl", "")
    if args.open_gmail and gmail_url:
        webbrowser.open(gmail_url)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
