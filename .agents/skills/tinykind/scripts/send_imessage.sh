#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Usage:
  send_imessage.sh --to <phone_or_email> --body <text> [--mode compose|send] [--link <url>] [--verify-focus] [--dry-run]

Modes:
  compose  Open Messages, prefill recipient + body, do not auto-send (default)
  send     Attempt to send directly via AppleScript (no compose UI)

Examples:
  send_imessage.sh --to "+15551234567" --body "A TinyKind from Angela"
  send_imessage.sh --to "+15551234567" --body "A TinyKind from Angela" --link "https://tinykind.app/t/abc123"
  send_imessage.sh --to "+15551234567" --body "A TinyKind from Angela" --verify-focus
  send_imessage.sh --to "name@example.com" --body "A TinyKind from Angela" --mode send
EOF
}

to=""
body=""
mode="compose"
dry_run="false"
verify_focus="false"
link=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --to)
      to="${2:-}"
      shift 2
      ;;
    --body)
      body="${2:-}"
      shift 2
      ;;
    --mode)
      mode="${2:-}"
      shift 2
      ;;
    --link)
      link="${2:-}"
      shift 2
      ;;
    --verify-focus)
      verify_focus="true"
      shift 1
      ;;
    --dry-run)
      dry_run="true"
      shift 1
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

if [[ -z "$to" || -z "$body" ]]; then
  echo "Both --to and --body are required." >&2
  usage >&2
  exit 2
fi

if [[ "$mode" != "compose" && "$mode" != "send" ]]; then
  echo "--mode must be 'compose' or 'send'." >&2
  exit 2
fi

if [[ -n "$link" ]]; then
  if [[ "$body" == *$'\n' ]]; then
    body="${body}${link}"
  else
    body="${body}"$'\n\n'"${link}"
  fi
fi

if [[ "$dry_run" == "true" ]]; then
  echo "[dry-run] mode=$mode to=$to"
  echo "[dry-run] verify_focus=$verify_focus"
  echo "[dry-run] body=$body"
  exit 0
fi

if [[ "$mode" == "send" ]]; then
  osascript <<EOF
on run
  set recipientHandle to "$(printf '%s' "$to" | sed 's/"/\\"/g')"
  set messageText to "$(printf '%s' "$body" | sed 's/"/\\"/g')"

  tell application "Messages"
    activate
    set targetService to missing value
    try
      set targetService to first service whose service type = iMessage
    end try
    if targetService is missing value then
      try
        set targetService to first service whose service type = SMS
      end try
    end if
    if targetService is missing value then
      error "No iMessage or SMS service is available in Messages."
    end if

    set targetParticipant to participant recipientHandle of targetService
    send messageText to targetParticipant
  end tell
end run
EOF
  echo "Sent via Messages AppleScript."
  exit 0
fi

osascript <<EOF
on compactText(t)
  return do shell script "printf %s " & quoted form of t & " | tr -cd '[:alnum:]@._'"
end compactText

on run
  set recipientHandle to "$(printf '%s' "$to" | sed 's/"/\\"/g')"
  set messageText to "$(printf '%s' "$body" | sed 's/"/\\"/g')"
  set verifyFocus to $verify_focus
  set recipientCompact to my compactText(recipientHandle)

  tell application "Messages" to activate
  delay 0.4

  tell application "System Events"
    tell process "Messages"
      keystroke "n" using {command down}
      delay 0.3
      keystroke recipientHandle
      key code 36
      delay 0.2
      -- First tab leaves recipient token field.
      key code 48
      delay 0.2
      -- Second tab focuses the message composer body field.
      key code 48
      delay 0.2
      set focusedValue to ""
      set stillInRecipientField to true
      repeat with i from 1 to 4
        try
          set focusedElement to value of attribute "AXFocusedUIElement"
          set focusedValue to ""
          try
            set focusedValue to value of focusedElement as text
          end try
        on error
          set focusedValue to "focus-error"
        end try

        set stillInRecipientField to false
        if focusedValue is not "" then
          set focusedCompact to my compactText(focusedValue)
          if recipientCompact is not "" and focusedCompact contains recipientCompact then
            set stillInRecipientField to true
          end if
        end if

        if stillInRecipientField is false then exit repeat
        key code 48
        delay 0.15
      end repeat
      if verifyFocus and stillInRecipientField then
        error "Unable to focus message body field. Aborting before typing message."
      end if
      keystroke messageText
    end tell
  end tell
end run
EOF

echo "Compose window opened in Messages and prefilled."
