#!/usr/bin/env python3
"""Install/remove a weekly TinyKind reminder on macOS using launchd."""

from __future__ import annotations

import argparse
import pathlib
import plistlib
import subprocess
import sys

LABEL = "com.tinykind.weekly-reminder"
DEFAULT_MESSAGE = "Who do you feel grateful for this week? Let's tell them!"
WEEKDAY_TO_INT = {
    "sun": 0,
    "sunday": 0,
    "mon": 1,
    "monday": 1,
    "tue": 2,
    "tues": 2,
    "tuesday": 2,
    "wed": 3,
    "wednesday": 3,
    "thu": 4,
    "thurs": 4,
    "thursday": 4,
    "fri": 5,
    "friday": 5,
    "sat": 6,
    "saturday": 6,
}


def launch_agent_path() -> pathlib.Path:
    return pathlib.Path.home() / "Library" / "LaunchAgents" / f"{LABEL}.plist"


def parse_hhmm(value: str) -> tuple[int, int]:
    try:
        hour_str, minute_str = value.split(":")
        hour = int(hour_str)
        minute = int(minute_str)
    except Exception as exc:  # noqa: BLE001
        raise argparse.ArgumentTypeError("Time must be HH:MM in 24-hour format.") from exc
    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise argparse.ArgumentTypeError("Hour must be 0-23 and minute must be 0-59.")
    return hour, minute


def normalize_weekday(value: str) -> int:
    key = value.strip().lower()
    if key not in WEEKDAY_TO_INT:
        allowed = ", ".join(sorted({"sun", "mon", "tue", "wed", "thu", "fri", "sat"}))
        raise argparse.ArgumentTypeError(f"Invalid weekday. Use one of: {allowed}")
    return WEEKDAY_TO_INT[key]


def run_launchctl(*args: str) -> None:
    subprocess.run(["launchctl", *args], check=False, capture_output=True)


def install_reminder(*, weekday: int, hour: int, minute: int, message: str) -> pathlib.Path:
    agent = launch_agent_path()
    agent.parent.mkdir(parents=True, exist_ok=True)

    script = (
        "display notification "
        + f"{message!r}"
        + " with title "
        + "'TinyKind Weekly Reminder'"
    )

    config = {
        "Label": LABEL,
        "ProgramArguments": ["osascript", "-e", script],
        "RunAtLoad": False,
        "StartCalendarInterval": {
            "Weekday": weekday,
            "Hour": hour,
            "Minute": minute,
        },
        "StandardOutPath": str(pathlib.Path.home() / "Library" / "Logs" / "tinykind-reminder.log"),
        "StandardErrorPath": str(pathlib.Path.home() / "Library" / "Logs" / "tinykind-reminder.log"),
    }
    with agent.open("wb") as file:
        plistlib.dump(config, file)

    run_launchctl("bootout", f"gui/{_uid()}", str(agent))
    run_launchctl("bootstrap", f"gui/{_uid()}", str(agent))
    run_launchctl("enable", f"gui/{_uid()}/{LABEL}")
    return agent


def uninstall_reminder() -> pathlib.Path:
    agent = launch_agent_path()
    run_launchctl("bootout", f"gui/{_uid()}", str(agent))
    if agent.exists():
        agent.unlink()
    return agent


def _uid() -> str:
    return str(subprocess.check_output(["id", "-u"], text=True).strip())


def status() -> tuple[pathlib.Path, bool]:
    agent = launch_agent_path()
    return agent, agent.exists()


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Schedule a weekly TinyKind reminder desktop notification on macOS."
    )
    subparsers = parser.add_subparsers(dest="command", required=True)

    install = subparsers.add_parser("install", help="Install or update reminder")
    install.add_argument("--weekday", required=True, type=normalize_weekday, help="mon..sun")
    install.add_argument("--time", required=True, type=parse_hhmm, help="HH:MM (24-hour)")
    install.add_argument("--message", default=DEFAULT_MESSAGE, help="Reminder message")

    subparsers.add_parser("uninstall", help="Remove reminder")
    subparsers.add_parser("status", help="Show reminder status")
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    if args.command == "install":
        hour, minute = args.time
        agent = install_reminder(
            weekday=args.weekday,
            hour=hour,
            minute=minute,
            message=args.message,
        )
        print(f"Installed weekly reminder at {agent}")
        return 0

    if args.command == "uninstall":
        agent = uninstall_reminder()
        print(f"Removed weekly reminder at {agent}")
        return 0

    agent, exists = status()
    if exists:
        print(f"Installed: {agent}")
    else:
        print("Not installed.")
    return 0


if __name__ == "__main__":
    if sys.platform != "darwin":
        print("This script currently supports macOS only.", file=sys.stderr)
        raise SystemExit(2)
    raise SystemExit(main())
