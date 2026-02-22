"use client";

import { useState } from "react";

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

export default function DashboardReminderForm({ initial }: { initial: ReminderState }) {
  const [state, setState] = useState<ReminderState>(initial);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState<string>("");

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
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to save reminder settings.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="panel p-5 md:p-7">
      <h2 className="text-2xl leading-tight">Weekly reminder</h2>
      <p className="mt-2 text-sm text-[var(--ink-soft)]">
        Who made your week a little better? Send them a TinyKind.
      </p>
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={onSubmit}>
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
          <input
            className="field mono"
            onChange={(event) => setState((prev) => ({ ...prev, timezone: event.target.value }))}
            placeholder="America/Los_Angeles"
            value={state.timezone}
          />
        </label>

        <div className="md:col-span-2">
          <button className="btn btn-primary" disabled={loading} type="submit">
            {loading ? "Saving..." : "Save reminder settings"}
          </button>
        </div>
      </form>
      {notice ? <p className="mt-3 text-sm text-[#174a8c]">{notice}</p> : null}
    </section>
  );
}

