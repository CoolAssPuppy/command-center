import { COMBINED_CALENDARS_ID, type Connection } from "../config/schema";
import type {
  ConferenceProvider,
  IntegrationResult,
  NormalizedItem,
} from "../integrations/types";
import { el, svgEl } from "../render/helpers";
import { isSafeUrl } from "../security/url";

/**
 * The "needs you" lane: the dashboard's one anchor. It does not echo the feeds;
 * it derives a few specific, glanceable sections from them. The next meeting
 * (with a live countdown and a Join button when there is a video link), the pull
 * requests waiting on your review, and your open tasks. Each section is grouped
 * by a small label and a hairline, never a box.
 */
export interface NeedsYouLaneModel {
  now: Date;
  connections: Connection[];
  integrationResults?: Record<string, IntegrationResult>;
}

export interface NeedsYouLaneDeps {
  navigate: (url: string) => void;
}

interface LaneEntry {
  item: NormalizedItem;
  service: string;
  /** The connection's role, when it sets one (Feature: source role toggle). */
  role?: "reference" | "tasks";
  /** Whether this came from a Linear connection in inbox mode. */
  linearInbox?: boolean;
}

export interface LaneBuckets {
  /** The next meeting, only when it starts within the coming hour. */
  meeting?: LaneEntry;
  reviews: LaneEntry[];
  linearInbox: LaneEntry[];
  tasks: LaneEntry[];
}

/** Items per list section, so the lane stays a glance. */
const SECTION_LIMIT = 5;
const TASK_SERVICES = new Set(["notion", "todoist", "google-tasks"]);
const HOUR_MS = 60 * 60 * 1000;

function connectionForKey(
  key: string,
  connections: Connection[],
): Connection | undefined {
  if (key === COMBINED_CALENDARS_ID) return undefined;
  return connections.find((connection) => connection.id === key);
}

/** A task source's items only reach the lane when its role resolves to "tasks".
 *  Google Tasks is a pure task source, so it defaults to tasks; the rest default
 *  to reference, so notes and the like stay out of the lane until opted in. */
function effectiveRole(service: string, role: "reference" | "tasks" | undefined): "reference" | "tasks" {
  if (role !== undefined) return role;
  return service === "google-tasks" ? "tasks" : "reference";
}

function collectEntries(
  results: Record<string, IntegrationResult>,
  connections: Connection[],
): LaneEntry[] {
  const hasCombined = results[COMBINED_CALENDARS_ID]?.status === "ok";
  const entries: LaneEntry[] = [];
  for (const [key, result] of Object.entries(results)) {
    if (result.status !== "ok" || result.items === undefined) continue;
    const connection = connectionForKey(key, connections);
    const service = key === COMBINED_CALENDARS_ID ? "google-calendar" : connection?.service;
    if (service === undefined) continue;
    if (hasCombined && service === "google-calendar" && key !== COMBINED_CALENDARS_ID) {
      continue;
    }
    for (const item of result.items) {
      const entry: LaneEntry = { item, service };
      if (connection?.role !== undefined) entry.role = connection.role;
      if (connection?.linearView === "inbox") entry.linearInbox = true;
      entries.push(entry);
    }
  }
  return entries;
}

/**
 * Derive the lane's sections from the raw entries: the soonest meeting inside
 * the next hour, the review-requested PRs, the Linear inbox, and the open tasks.
 * Past meetings and meetings further out are left to the calendar feed.
 */
export function buildLaneBuckets(entries: LaneEntry[], now: Date): LaneBuckets {
  const nowMs = now.getTime();

  const meeting = entries
    .filter(
      (entry) =>
        entry.service === "google-calendar" &&
        entry.item.startMs !== undefined &&
        entry.item.startMs >= nowMs - 5 * 60 * 1000 &&
        entry.item.startMs <= nowMs + HOUR_MS,
    )
    .sort((a, b) => (a.item.startMs ?? 0) - (b.item.startMs ?? 0))[0];

  const reviews = entries
    .filter((entry) => entry.service === "github" && entry.item.tone === "urgent")
    .slice(0, SECTION_LIMIT);

  const linearInbox = entries
    .filter((entry) => entry.service === "linear" && entry.linearInbox === true)
    .slice(0, SECTION_LIMIT);

  const tasks = entries
    .filter(
      (entry) =>
        TASK_SERVICES.has(entry.service) &&
        effectiveRole(entry.service, entry.role) === "tasks",
    )
    .slice(0, SECTION_LIMIT);

  const buckets: LaneBuckets = { reviews, linearInbox, tasks };
  if (meeting !== undefined) buckets.meeting = meeting;
  return buckets;
}

/** A human countdown to a start time, or undefined once it is well underway. */
export function formatCountdown(startMs: number, nowMs: number): string | undefined {
  const diff = startMs - nowMs;
  if (diff < -60_000) return undefined;
  if (diff <= 60_000) return "now";
  const minutes = Math.round(diff / 60_000);
  if (minutes < 60) return `in ${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `in ${String(hours)} hr` : `in ${String(hours)} hr ${String(rest)} min`;
}

const PROVIDER_COLOR: Record<ConferenceProvider, string> = {
  meet: "#00ac47",
  zoom: "#2d8cff",
  teams: "#6264a7",
  other: "currentColor",
};

const PROVIDER_LABEL: Record<ConferenceProvider, string> = {
  meet: "Join Meet",
  zoom: "Join Zoom",
  teams: "Join Teams",
  other: "Join",
};

function conferenceIcon(provider: ConferenceProvider): SVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "14",
    height: "14",
    fill: "none",
    stroke: PROVIDER_COLOR[provider],
    "stroke-width": "2",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(svgEl("rect", { x: "2", y: "6", width: "13", height: "12", rx: "2" }));
  svg.appendChild(svgEl("path", { d: "M22 8l-5 4 5 4V8z" }));
  return svg;
}

function renderLaneItem(entry: LaneEntry, deps: NeedsYouLaneDeps): HTMLElement {
  const { item } = entry;
  const navigable = item.url !== undefined && isSafeUrl(item.url);
  const row = el(navigable ? "button" : "div", "cc-lane__item");
  row.dataset.tone = item.tone ?? "neutral";
  if (navigable && item.url !== undefined) {
    const url = item.url;
    row.setAttribute("type", "button");
    row.addEventListener("click", () => {
      deps.navigate(url);
    });
  }

  row.appendChild(el("span", "cc-lane__dot"));
  const body = el("div", "cc-lane__item-body");
  body.appendChild(el("span", "cc-lane__item-title", item.title));
  const sub = item.subtitle ?? item.meta;
  if (sub !== undefined) body.appendChild(el("span", "cc-lane__item-sub", sub));
  row.appendChild(body);
  return row;
}

function renderSection(
  label: string,
  entries: LaneEntry[],
  deps: NeedsYouLaneDeps,
): HTMLElement {
  const section = el("div", "cc-lane__section");
  section.appendChild(el("div", "cc-lane__label", label));
  const list = el("div", "cc-lane__list");
  for (const entry of entries) list.appendChild(renderLaneItem(entry, deps));
  section.appendChild(list);
  return section;
}

function renderMeetingSection(
  entry: LaneEntry,
  now: Date,
  deps: NeedsYouLaneDeps,
): HTMLElement {
  const { item } = entry;
  const section = el("div", "cc-lane__section");
  section.appendChild(el("div", "cc-lane__label", "Next meeting"));

  const card = el("div", "cc-lane__meeting");
  card.dataset.tone = item.tone ?? "neutral";
  card.appendChild(el("span", "cc-lane__dot"));

  const body = el("div", "cc-lane__item-body");
  body.appendChild(el("span", "cc-lane__meeting-title", item.title));
  const countdown =
    item.startMs !== undefined ? formatCountdown(item.startMs, now.getTime()) : undefined;
  const parts = [item.subtitle, countdown].filter(
    (part): part is string => part !== undefined && part.length > 0,
  );
  if (parts.length > 0) {
    body.appendChild(el("span", "cc-lane__meeting-when", parts.join(" · ")));
  }
  card.appendChild(body);

  if (item.joinUrl !== undefined && isSafeUrl(item.joinUrl)) {
    const provider = item.conferenceProvider ?? "other";
    const join = el("button", "cc-lane__join");
    join.setAttribute("type", "button");
    join.dataset.provider = provider;
    join.appendChild(conferenceIcon(provider));
    join.appendChild(el("span", undefined, PROVIDER_LABEL[provider]));
    const joinUrl = item.joinUrl;
    join.addEventListener("click", () => {
      deps.navigate(joinUrl);
    });
    card.appendChild(join);
  }

  section.appendChild(card);
  return section;
}

export function renderNeedsYouLane(
  host: HTMLElement,
  model: NeedsYouLaneModel,
  deps: NeedsYouLaneDeps,
): HTMLElement {
  const root = el("section", "cc-lane");
  root.dataset.flipId = "needs-you";
  root.appendChild(el("h2", "cc-lane__title", "Needs you"));

  const buckets: LaneBuckets =
    model.integrationResults !== undefined
      ? buildLaneBuckets(collectEntries(model.integrationResults, model.connections), model.now)
      : { reviews: [], linearInbox: [], tasks: [] };

  let any = false;
  if (buckets.meeting !== undefined) {
    root.appendChild(renderMeetingSection(buckets.meeting, model.now, deps));
    any = true;
  }
  if (buckets.reviews.length > 0) {
    root.appendChild(renderSection("Review requested", buckets.reviews, deps));
    any = true;
  }
  if (buckets.linearInbox.length > 0) {
    root.appendChild(renderSection("Linear inbox", buckets.linearInbox, deps));
    any = true;
  }
  if (buckets.tasks.length > 0) {
    root.appendChild(renderSection("Tasks", buckets.tasks, deps));
    any = true;
  }

  if (!any) {
    root.appendChild(
      el("div", "cc-lane__empty", "You are all clear. Nothing is waiting on you."),
    );
  }

  host.appendChild(root);
  return root;
}
