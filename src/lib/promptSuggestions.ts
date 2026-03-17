const PROMPT_ROTATIONS: Record<number, readonly (readonly string[])[]> = {
  0: [
    [
      "Who made your week a little better?",
      "Who showed up for you this week?",
      "Who deserves a Sunday thank-you?",
    ],
    [
      "Who are you ending the week grateful for?",
      "Who quietly helped this week?",
      "Who would smile getting a note today?",
    ],
  ],
  1: [
    [
      "Who made your weekend better?",
      "Who helped you start the week lighter?",
      "Who are you carrying gratitude for into Monday?",
    ],
    [
      "Who gave you energy this weekend?",
      "Who made Monday easier already?",
      "Who could use a kind note today?",
    ],
  ],
  2: [
    [
      "Who checked in when it mattered?",
      "Who made this week feel easier?",
      "Who have you been meaning to thank?",
    ],
    [
      "Who made Tuesday less heavy?",
      "Who helped without being asked?",
      "Who would love a small note from you?",
    ],
  ],
  3: [
    [
      "Who steadied your week so far?",
      "Who made the middle of the week better?",
      "Who deserves a midweek thank-you?",
    ],
    [
      "Who has been quietly generous lately?",
      "Who helped you keep going this week?",
      "Who would appreciate hearing this today?",
    ],
  ],
  4: [
    [
      "Who made this week easier to carry?",
      "Who do you want to thank before Friday?",
      "Who helped behind the scenes this week?",
    ],
    [
      "Who has been on your mind with gratitude?",
      "Who deserves a note before the week wraps?",
      "Who made things feel lighter today?",
    ],
  ],
  5: [
    [
      "Who helped you this week?",
      "Who made Friday feel better?",
      "Who deserves a little appreciation before the weekend?",
    ],
    [
      "Who showed up for you this week?",
      "Who are you grateful for today?",
      "Who would love a Friday TinyKind?",
    ],
  ],
  6: [
    [
      "Who made you laugh this week?",
      "Who made your Saturday better?",
      "Who deserves a weekend thank-you?",
    ],
    [
      "Who are you appreciating this weekend?",
      "Who gave you a little lift this week?",
      "Who have you been wanting to text thank you to?",
    ],
  ],
};

function getLocalWeekday(date: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const weekdayLabel = formatter.format(date);
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return weekdayMap[weekdayLabel] ?? 0;
}

function getRotationIndex(date: Date, timezone: string, count: number): number {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const localDate = formatter.format(date);
  let hash = 0;
  for (const char of localDate) {
    hash = (hash * 31 + char.charCodeAt(0)) % 1_000_000_007;
  }
  return hash % count;
}

export function getPromptSuggestionsForDate(date: Date, timezone = "America/Los_Angeles"): string[] {
  const weekday = getLocalWeekday(date, timezone);
  const rotations = PROMPT_ROTATIONS[weekday] ?? PROMPT_ROTATIONS[0];
  const index = getRotationIndex(date, timezone, rotations.length);
  return [...rotations[index]];
}
