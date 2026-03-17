"use client";

import { useMemo, useState } from "react";

interface ReminderState {
  enabled: boolean;
  weekday: number;
  hour: number;
  minute: number;
  timezone: string;
}

const WEEKDAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
];

const FALLBACK_TIMEZONES = [
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "Europe/London",
  "Europe/Paris",
  "Asia/Tokyo",
  "Australia/Sydney",
];

function formatSummary(state: ReminderState): string {
  if (!state.enabled) {
    return "Off";
  }
  const day = WEEKDAYS.find((item) => item.value === state.weekday)?.label ?? "Sunday";
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(Date.UTC(2024, 0, 1, state.hour, state.minute)));
  return `Your reminder is set 🔔 — We'll nudge you ${day} at ${time}`;
}

export default function DashboardReminderForm({ initial }: { initial: ReminderState }) {
  const localTimezone =
    typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Los_Angeles" : "America/Los_Angeles";
  const [state, setState] = useState<ReminderState>({ ...initial, timezone: initial.timezone || localTimezone });
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string>("");
  const [expanded, setExpanded] = useState(false);

  const timezoneOptions = useMemo(() => {
    if (typeof Intl !== "undefined" && typeof (Intl as typeof Intl & { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf === "function") {
      const values = (Intl as typeof Intl & { supportedValuesOf: (key: string) => string[] }).supportedValuesOf("timeZone");
      return values;
    }
    return FALLBACK_TIMEZONES;
  }, []);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    try {
      const response = await fetch("/api/reminders/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(state),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to save reminder settings.");
      }
      setNotice("Reminder settings saved.");
      setExpanded(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save reminder settings.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel p-5 md:p-7">
      <button className="flex w-full items-start justify-between gap-4 text-left" onClick={() => setExpanded((prev) => !prev)} type="button">
        <div>
          <h2 className="text-2xl leading-tight">Weekly reminder</h2>
          <p className="mt-1 text-sm text-[#6B6B6B]">Who made your week a little better? Send them a TinyKind.</p>
          <div className="mt-2 inline-flex rounded-full border border-[#E8E6E3] bg-[#FFFFFF] px-3 py-1 text-xs text-[#6B6B6B]">
            {formatSummary(state)}
          </div>
        </div>
        <span className="mt-1 rounded-full border border-[#E8E6E3] bg-[#ffffff] px-3 py-1 text-xs font-semibold text-[#2E2E2E]">
          {expanded ? "Hide" : "Adjust"}
        </span>
      </button>

      {expanded ? (
        <form className="mt-5 grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
          <label className="flex items-center gap-2 text-sm font-medium md:col-span-2">
            <input
              checked={state.enabled}
              onChange={(event) => setState((prev) => ({ ...prev, enabled: event.target.checked }))}
              type="checkbox"
            />
            Enable weekly reminder email
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Day
            <select
              className="field"
              onChange={(event) => setState((prev) => ({ ...prev, weekday: Number(event.target.value) }))}
              value={state.weekday}
            >
              {WEEKDAYS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm font-medium">
            Time (24h)
            <input
              className="field"
              onChange={(event) => {
                const [hourStr, minuteStr] = event.target.value.split(":");
                setState((prev) => ({
                  ...prev,
                  hour: Number(hourStr || 0),
                  minute: Number(minuteStr || 0),
                }));
              }}
              type="time"
              value={`${String(state.hour).padStart(2, "0")}:${String(state.minute).padStart(2, "0")}`}
            />
          </label>

          <label className="grid gap-1 text-sm font-medium md:col-span-2">
            Timezone
            <select
              className="field mono"
              onChange={(event) => setState((prev) => ({ ...prev, timezone: event.target.value }))}
              value={state.timezone}
            >
              {timezoneOptions.map((timezone) => (
                <option key={timezone} value={timezone}>
                  {timezone}
                </option>
              ))}
            </select>
          </label>

          <div className="md:col-span-2 flex flex-wrap gap-2">
            <button className="btn btn-soft" onClick={() => setState((prev) => ({ ...prev, timezone: localTimezone }))} type="button">
              Use local timezone
            </button>
            <button className="btn btn-primary" disabled={loading} type="submit">
              {loading ? "Saving..." : "Save reminder settings"}
            </button>
          </div>
        </form>
      ) : null}

      {notice ? <p className="mt-3 text-sm text-[#6B6B6B]">{notice}</p> : null}
    </section>
  );
}
