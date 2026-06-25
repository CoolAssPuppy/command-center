import {
  COMBINED_CALENDARS_ID,
  type Connection,
  type Zone,
} from "../config/schema";
import type { IntegrationResult, NormalizedItem } from "../integrations/types";
import { el } from "../render/helpers";
import { isSafeUrl } from "../security/url";
import { renderMeetingWindow } from "./meetingWindow";

/**
 * The "needs you" lane: the dashboard's one anchor. Rather than four parallel
 * feeds you triage yourself, it pulls the pressing items from every connected
 * source into a single ranked list (the meeting-overlap window first, then
 * whatever is urgent, then the soonest calendar events). It reads the same
 * integration results the feeds do, so it adds synthesis without new fetches.
 */
export interface NeedsYouLaneModel {
  now: Date;
  homeZone: Zone;
  zones: Zone[];
  connections: Connection[];
  hour12?: boolean;
  showMeetingWindow?: boolean;
  integrationResults?: Record<string, IntegrationResult>;
}

export interface NeedsYouLaneDeps {
  navigate: (url: string) => void;
}

interface LaneEntry {
  item: NormalizedItem;
  service: string;
}

/** The most items the lane shows, so it stays a glance and not a backlog. */
const LANE_LIMIT = 7;

function serviceForKey(key: string, connections: Connection[]): string | undefined {
  if (key === COMBINED_CALENDARS_ID) return "google-calendar";
  return connections.find((connection) => connection.id === key)?.service;
}

/**
 * Gather every loaded item across sources, tagged with its service. When a
 * "combine all calendars" stream is present, the individual calendar results are
 * skipped so events are not counted twice.
 */
function collectEntries(
  results: Record<string, IntegrationResult>,
  connections: Connection[],
): LaneEntry[] {
  const hasCombined =
    results[COMBINED_CALENDARS_ID]?.status === "ok";
  const entries: LaneEntry[] = [];
  for (const [key, result] of Object.entries(results)) {
    if (result.status !== "ok" || result.items === undefined) continue;
    const service = serviceForKey(key, connections);
    if (service === undefined) continue;
    if (hasCombined && service === "google-calendar" && key !== COMBINED_CALENDARS_ID) {
      continue;
    }
    for (const item of result.items) entries.push({ item, service });
  }
  return entries;
}

/**
 * Rank what needs you: urgent items first, then the soonest upcoming calendar
 * events, deduped by id and capped. Calendar events sort ascending by start so
 * the next thing on the schedule leads its group.
 */
export function rankLaneEntries(entries: LaneEntry[]): LaneEntry[] {
  const urgent = entries.filter((entry) => entry.item.tone === "urgent");
  const upcomingCalendar = entries
    .filter(
      (entry) =>
        entry.service === "google-calendar" &&
        entry.item.tone !== "urgent" &&
        entry.item.sortKey !== undefined,
    )
    .sort((a, b) => (a.item.sortKey ?? "").localeCompare(b.item.sortKey ?? ""));

  const ranked: LaneEntry[] = [];
  const seen = new Set<string>();
  for (const entry of [...urgent, ...upcomingCalendar]) {
    if (seen.has(entry.item.id)) continue;
    seen.add(entry.item.id);
    ranked.push(entry);
    if (ranked.length >= LANE_LIMIT) break;
  }
  return ranked;
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

export function renderNeedsYouLane(
  host: HTMLElement,
  model: NeedsYouLaneModel,
  deps: NeedsYouLaneDeps,
): HTMLElement {
  const root = el("section", "cc-lane");
  root.dataset.flipId = "needs-you";

  const head = el("div", "cc-lane__head");
  head.appendChild(el("h2", "cc-lane__title", "Needs you"));
  root.appendChild(head);

  if (model.showMeetingWindow !== false && model.zones.length >= 2) {
    renderMeetingWindow(root, {
      now: model.now,
      zones: model.zones,
      homeZone: model.homeZone,
      hour12: model.hour12 ?? true,
    });
  }

  const ranked =
    model.integrationResults !== undefined
      ? rankLaneEntries(collectEntries(model.integrationResults, model.connections))
      : [];

  if (ranked.length === 0) {
    root.appendChild(
      el(
        "div",
        "cc-lane__empty",
        model.integrationResults === undefined
          ? "Connect a source to see what needs you."
          : "You are all clear. Nothing is waiting on you.",
      ),
    );
    host.appendChild(root);
    return root;
  }

  const list = el("div", "cc-lane__list");
  for (const entry of ranked) list.appendChild(renderLaneItem(entry, deps));
  root.appendChild(list);

  host.appendChild(root);
  return root;
}
