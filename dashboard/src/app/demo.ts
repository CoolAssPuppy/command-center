import { describeWeatherCode, type Weather, type WeatherUnits } from "../weather/openMeteo";
import type { StockQuote } from "../integrations/finnhub";
import type { NewsItem } from "../integrations/news";
import type { IntegrationResult, NormalizedItem } from "../integrations/types";

/**
 * Screenshot mode. When localStorage "cc:demo" is "1" (or the url has ?demo),
 * every source serves canned data instead of fetching: the data cards, the
 * "needs you" lane, the weather, and the tickers all look populated without any
 * real account connected. Toggled from the Support section and reverted cleanly,
 * since it only overrides what is displayed and never touches the saved config
 * or secrets. Inert otherwise.
 */
const DEMO_KEY = "cc:demo";

export function isDemoMode(): boolean {
  try {
    const scope = globalThis as {
      localStorage?: Storage;
      location?: { search?: string };
    };
    if (scope.location?.search?.includes("demo") === true) return true;
    return scope.localStorage?.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

/** Turn screenshot mode on or off for this device. */
export function setDemoMode(on: boolean): void {
  try {
    const scope = globalThis as { localStorage?: Storage };
    if (on) scope.localStorage?.setItem(DEMO_KEY, "1");
    else scope.localStorage?.removeItem(DEMO_KEY);
  } catch {
    /* localStorage may be unavailable; screenshot mode is best-effort. */
  }
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "9:05 AM" for a time, in the local zone, matching the calendar feed's style. */
function clockLabel(date: Date): string {
  let hour = date.getHours();
  const minute = date.getMinutes().toString().padStart(2, "0");
  const meridiem = hour >= 12 ? "PM" : "AM";
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${String(hour)}:${minute} ${meridiem}`;
}

/** "YYYY-MM-DD" in the local zone, for forecast day keys. */
function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Today's events, anchored to now so the lane shows a real countdown and a Join
 * button: the next meeting starts in a quarter hour with a Google Meet link.
 */
function demoCalendarItems(now: Date): NormalizedItem[] {
  const standup = new Date(now.getTime() - 3 * HOUR);
  const syncPast = new Date(now.getTime() - 80 * MINUTE);
  const next = new Date(now.getTime() + 14 * MINUTE);
  const oneOnOne = new Date(now.getTime() + 95 * MINUTE);
  const lunch = new Date(now.getTime() + 3 * HOUR);
  const review = new Date(now.getTime() + 5 * HOUR);
  const allDayKey = isoDate(now);
  return [
    // All-day events (three, so the demo shows the "N all-day events" fold).
    {
      id: "demo-cal-offsite",
      title: "Company offsite",
      subtitle: "All day",
      sortKey: allDayKey,
      isAllDay: true,
    },
    {
      id: "demo-cal-pto",
      title: "Jordan out (PTO)",
      subtitle: "All day",
      sortKey: allDayKey,
      isAllDay: true,
    },
    {
      id: "demo-cal-freeze",
      title: "Release freeze",
      subtitle: "All day",
      sortKey: allDayKey,
      isAllDay: true,
    },
    // Finished earlier today, so they fold behind "N prior events".
    {
      id: "demo-cal-standup",
      title: "Daily standup",
      subtitle: clockLabel(standup),
      sortKey: standup.toISOString(),
      startMs: standup.getTime(),
      endMs: standup.getTime() + 15 * MINUTE,
    },
    {
      id: "demo-cal-sync",
      title: "Marketing sync",
      subtitle: clockLabel(syncPast),
      sortKey: syncPast.toISOString(),
      startMs: syncPast.getTime(),
      endMs: syncPast.getTime() + 30 * MINUTE,
    },
    // Still ahead: shown inline.
    {
      id: "demo-cal-review",
      title: "Design review",
      subtitle: clockLabel(next),
      meta: "Google Meet",
      sortKey: next.toISOString(),
      startMs: next.getTime(),
      endMs: next.getTime() + 30 * MINUTE,
      joinUrl: "https://meet.google.com/demo-abcd-efg",
      conferenceProvider: "meet",
    },
    {
      id: "demo-cal-oneonone",
      title: "1:1 with Alex",
      subtitle: clockLabel(oneOnOne),
      sortKey: oneOnOne.toISOString(),
      startMs: oneOnOne.getTime(),
      endMs: oneOnOne.getTime() + 30 * MINUTE,
    },
    {
      id: "demo-cal-lunch",
      title: "Lunch with Sam",
      subtitle: clockLabel(lunch),
      sortKey: lunch.toISOString(),
      startMs: lunch.getTime(),
      endMs: lunch.getTime() + HOUR,
    },
    {
      id: "demo-cal-ship",
      title: "Ship review",
      subtitle: clockLabel(review),
      meta: "War room",
      sortKey: review.toISOString(),
      startMs: review.getTime(),
      endMs: review.getTime() + HOUR,
    },
  ];
}

const linearItems: NormalizedItem[] = [
  { id: "demo-lin-1", title: "Fix flaky auth test", meta: "In Progress", icon: "linear-issue", tone: "urgent" },
  { id: "demo-lin-2", title: "Mobile navigation redesign", meta: "Project", icon: "linear-project" },
  { id: "demo-lin-3", title: "Reliability initiative", meta: "Initiative", icon: "linear-initiative" },
  { id: "demo-lin-4", title: "Investigate slow dashboard query", meta: "In Review", icon: "linear-issue" },
  { id: "demo-lin-5", title: "Dark mode polish", meta: "Todo", icon: "linear-issue" },
];

const notionNotes: NormalizedItem[] = [
  { id: "demo-note-1", title: "Q3 planning doc", meta: "Edited yesterday" },
  { id: "demo-note-2", title: "Brand voice guide", meta: "Edited 3d ago" },
  { id: "demo-note-3", title: "Launch checklist", meta: "Edited 1w ago" },
  { id: "demo-note-4", title: "Competitive teardown", meta: "Edited 2w ago" },
];

const notionTasks: NormalizedItem[] = [
  { id: "demo-ntask-1", title: "Draft the Q3 narrative", sortKey: "2026-06-25", task: { due: "Today", status: "In progress" } },
  { id: "demo-ntask-2", title: "Review design system updates", sortKey: "2026-06-26", task: { due: "Tomorrow", status: "Todo" } },
  { id: "demo-ntask-3", title: "Close out launch retro", sortKey: "2026-06-27", task: { due: "Fri", status: "Todo" } },
  { id: "demo-ntask-4", title: "Update the team wiki", task: { status: "Backlog" } },
];

const googleTasks: NormalizedItem[] = [
  { id: "demo-gtask-1", title: "Review Q3 budget", sortKey: "2026-06-25", task: { due: "Today", status: "Needs action" } },
  { id: "demo-gtask-2", title: "Send the offsite agenda", sortKey: "2026-06-26", task: { due: "Tomorrow", status: "Needs action" } },
  { id: "demo-gtask-3", title: "Book flights for the summit", sortKey: "2026-06-29", task: { due: "Mon", status: "Needs action" } },
];

const todoistTasks: NormalizedItem[] = [
  { id: "demo-todo-1", title: "Reply to investor email", sortKey: "2026-06-25", task: { due: "Today", priority: "P1" } },
  { id: "demo-todo-2", title: "Prep the board deck", sortKey: "2026-06-26", task: { due: "Tomorrow", priority: "P2" } },
  { id: "demo-todo-3", title: "Renew the domain", task: { priority: "P3" } },
];

const githubItems: NormalizedItem[] = [
  {
    id: "demo-pr-1",
    title: "Add rate limiting to the public API",
    subtitle: "acme/api #482",
    meta: "Review requested",
    tone: "urgent",
    url: "https://github.com/acme/api/pull/482",
  },
  {
    id: "demo-pr-2",
    title: "Fix memory leak in the worker pool",
    subtitle: "acme/worker #119",
    meta: "Review requested",
    tone: "urgent",
    url: "https://github.com/acme/worker/pull/119",
  },
  {
    id: "demo-pr-3",
    title: "Bump dependencies to latest",
    subtitle: "acme/web #771",
    meta: "Approved",
    tone: "positive",
    url: "https://github.com/acme/web/pull/771",
  },
];

/**
 * Canned items for a service. The role lets one service serve two looks: a
 * Notion card set to tasks gets task rows, otherwise it gets notes. `now`
 * anchors the calendar so the lane's countdown is live.
 */
export function demoResultFor(service: string, now: Date, role?: string): IntegrationResult {
  switch (service) {
    case "google-calendar":
      return { status: "ok", items: demoCalendarItems(now) };
    case "linear":
      return { status: "ok", items: linearItems };
    case "github":
      return { status: "ok", items: githubItems };
    case "google-tasks":
      return { status: "ok", items: googleTasks };
    case "todoist":
      return { status: "ok", items: todoistTasks };
    case "notion":
      return { status: "ok", items: role === "tasks" ? notionTasks : notionNotes };
    default:
      return { status: "ok", items: demoCalendarItems(now) };
  }
}

/** The merged calendar for combined cards: the same events as a calendar card. */
export function demoCombinedCalendars(now: Date): IntegrationResult {
  return { status: "ok", items: demoCalendarItems(now) };
}

/** A weather profile: a current condition and the five-day arc that follows it. */
interface DemoWeatherProfile {
  /** Today's temperature in Celsius, converted to the requested unit. */
  tempC: number;
  /** WMO codes for today plus the next four days. */
  codes: [number, number, number, number, number];
  /** Daily highs and lows in Celsius, today first. */
  highsC: [number, number, number, number, number];
  lowsC: [number, number, number, number, number];
}

const DEFAULT_WEATHER_PROFILE: DemoWeatherProfile = {
  tempC: 24,
  codes: [0, 1, 2, 0, 3],
  highsC: [26, 27, 24, 25, 22],
  lowsC: [16, 17, 15, 15, 14],
};

const WEATHER_PROFILES: DemoWeatherProfile[] = [
  DEFAULT_WEATHER_PROFILE,
  { tempC: 18, codes: [2, 3, 61, 80, 1], highsC: [20, 19, 17, 18, 21], lowsC: [12, 11, 10, 11, 13] },
  { tempC: 14, codes: [61, 63, 3, 2, 0], highsC: [16, 15, 18, 20, 22], lowsC: [9, 8, 10, 12, 13] },
  { tempC: 28, codes: [0, 0, 1, 2, 95], highsC: [30, 31, 29, 27, 24], lowsC: [21, 22, 20, 19, 18] },
  { tempC: 11, codes: [3, 45, 61, 2, 1], highsC: [13, 12, 11, 14, 16], lowsC: [6, 5, 5, 7, 9] },
];

function toUnit(celsius: number, unit: WeatherUnits): number {
  if (unit !== "fahrenheit") return celsius;
  return Math.round((celsius * 9) / 5 + 32);
}

/**
 * Canned weather for a zone, varied by index so the row reads naturally across
 * cities. Carries a five-day forecast for the strip and a high, low, sunrise,
 * and sunset for the home card.
 */
export function demoWeatherFor(index: number, now: Date, unit: WeatherUnits): Weather {
  const profile = WEATHER_PROFILES[index % WEATHER_PROFILES.length] ?? DEFAULT_WEATHER_PROFILE;
  const today = describeWeatherCode(profile.codes[0]);
  const daily = profile.codes.map((code, day) => {
    const described = describeWeatherCode(code);
    return {
      date: isoDate(new Date(now.getTime() + day * DAY)),
      code,
      condition: described.condition,
      icon: described.icon,
      high: toUnit(profile.highsC[day] ?? profile.tempC, unit),
      low: toUnit(profile.lowsC[day] ?? profile.tempC, unit),
    };
  });
  return {
    temperature: toUnit(profile.tempC, unit),
    unit,
    code: profile.codes[0],
    condition: today.condition,
    icon: today.icon,
    high: toUnit(profile.highsC[0], unit),
    low: toUnit(profile.lowsC[0], unit),
    sunrise: `${isoDate(now)}T06:12`,
    sunset: `${isoDate(now)}T20:48`,
    daily,
  };
}

/** Canned stock quotes for the strip: gainers, a loser, and a currency pair. */
export const demoStocks: StockQuote[] = [
  { symbol: "AAPL", price: 224.31, change: 2.18, changePercent: 0.98 },
  { symbol: "MSFT", price: 451.27, change: 3.94, changePercent: 0.88 },
  { symbol: "NVDA", price: 138.42, change: 4.51, changePercent: 3.37 },
  { symbol: "TSLA", price: 246.09, change: -5.82, changePercent: -2.31 },
  { symbol: "GOOG", price: 181.55, change: -1.12, changePercent: -0.61 },
  { symbol: "EURUSD", price: 1.0842, change: 0.0021, changePercent: 0.19, isForex: true },
];

/** Canned headlines for the news strip, across a few familiar sources. */
export const demoNews: NewsItem[] = [
  { title: "A quiet new tab is the productivity tool nobody talks about", url: "https://news.ycombinator.com/", source: "Hacker News", iconHost: "news.ycombinator.com" },
  { title: "The case for calmer software", url: "https://www.theverge.com/", source: "The Verge", iconHost: "theverge.com" },
  { title: "How small teams ship without the noise", url: "https://techcrunch.com/", source: "TechCrunch", iconHost: "techcrunch.com" },
  { title: "Markets steady as tech leads modest gains", url: "https://www.nytimes.com/", source: "NYT", iconHost: "nytimes.com" },
];
