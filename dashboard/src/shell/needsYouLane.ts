import { COMBINED_CALENDARS_ID, type Connection, type Stream } from "../config/schema";
import type {
  ConferenceProvider,
  IntegrationResult,
  NormalizedItem,
  TaskFields,
} from "../integrations/types";
import { el, svgEl } from "../render/helpers";
import { isSafeUrl } from "../security/url";
import { itemIcon } from "./itemIcons";
import { DEFAULT_TASK_FILTER, type TaskFilterState } from "./taskFilterState";

/**
 * The "needs you" lane: the dashboard's one anchor. It does not echo the feeds;
 * it derives a few specific, glanceable sections from them. The next meeting
 * (with a live countdown and a Join button when there is a video link), the pull
 * requests waiting on your review, and your open tasks. Each section is grouped
 * by a small label and a hairline, never a box.
 */
export interface NeedsYouLaneModel {
  now: Date;
  /** The Data Cards, which carry the per-source config (role, linearView). */
  streams: Stream[];
  /** Base connections, to resolve a card's service. */
  connections: Connection[];
  integrationResults?: Record<string, IntegrationResult>;
  /** The persisted Tasks-section filter and sort; defaults to all, soonest first. */
  taskFilter?: TaskFilterState;
}

export interface NeedsYouLaneDeps {
  navigate: (url: string) => void;
  /** Persist a changed Tasks filter so it survives the next repaint. */
  onTaskFilterChange?: (state: TaskFilterState) => void;
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

/** A card's items only reach the lane's Tasks section when its role resolves to
 *  "tasks". Google Tasks is a pure task source, so it defaults to tasks; the rest
 *  default to reference, so notes and the like stay out until opted in. */
function effectiveRole(service: string, role: "reference" | "tasks" | undefined): "reference" | "tasks" {
  if (role !== undefined) return role;
  return service === "google-tasks" ? "tasks" : "reference";
}

/**
 * Results are keyed by Data Card (stream) id, so each card's service, role, and
 * Linear view come from the card and its base connection.
 */
function collectEntries(
  results: Record<string, IntegrationResult>,
  streams: Stream[],
  connections: Connection[],
): LaneEntry[] {
  const hasCombined = results[COMBINED_CALENDARS_ID]?.status === "ok";
  const streamById = new Map(streams.map((stream) => [stream.id, stream]));
  const serviceById = new Map(connections.map((c) => [c.id, c.service]));
  const entries: LaneEntry[] = [];
  for (const [key, result] of Object.entries(results)) {
    if (result.status !== "ok" || result.items === undefined) continue;
    const stream = key === COMBINED_CALENDARS_ID ? undefined : streamById.get(key);
    const service =
      key === COMBINED_CALENDARS_ID
        ? "google-calendar"
        : stream !== undefined
          ? serviceById.get(stream.connectionId)
          : undefined;
    if (service === undefined) continue;
    if (hasCombined && service === "google-calendar" && key !== COMBINED_CALENDARS_ID) {
      continue;
    }
    for (const item of result.items) {
      const entry: LaneEntry = { item, service };
      if (stream?.role !== undefined) entry.role = stream.role;
      if (stream?.linearView === "inbox") entry.linearInbox = true;
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

  // Tasks are not capped here: the section filters and sorts them first, then
  // limits for display, so the filter sees the whole set.
  const tasks = entries.filter(
    (entry) =>
      TASK_SERVICES.has(entry.service) &&
      effectiveRole(entry.service, entry.role) === "tasks",
  );

  const buckets: LaneBuckets = { reviews, linearInbox, tasks };
  if (meeting !== undefined) buckets.meeting = meeting;
  return buckets;
}

/** The distinct task statuses present, in first-seen order (blank ones skipped). */
export function distinctStatuses(entries: LaneEntry[]): string[] {
  const seen: string[] = [];
  for (const entry of entries) {
    const status = entry.item.task?.status;
    if (status !== undefined && status.length > 0 && !seen.includes(status)) {
      seen.push(status);
    }
  }
  return seen;
}

/**
 * Apply the Tasks filter and sort. Undefined statuses shows everything; a list
 * shows only those, though a task with no status always shows. Sort is by due
 * date (the item's sortKey), with undated tasks last in both directions.
 */
export function applyTaskFilter(entries: LaneEntry[], state: TaskFilterState): LaneEntry[] {
  const filtered =
    state.statuses === undefined
      ? entries
      : entries.filter((entry) => {
          const status = entry.item.task?.status;
          return status === undefined || state.statuses?.includes(status) === true;
        });
  const direction = state.sort === "desc" ? -1 : 1;
  return [...filtered].sort((a, b) => {
    const ak = a.item.sortKey;
    const bk = b.item.sortKey;
    if (ak === undefined && bk === undefined) return 0;
    if (ak === undefined) return 1;
    if (bk === undefined) return -1;
    return direction * ak.localeCompare(bk);
  });
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
  if (item.icon !== undefined) {
    const iconWrap = el("span", "cc-lane__item-icon");
    iconWrap.setAttribute("aria-hidden", "true");
    iconWrap.appendChild(itemIcon(item.icon));
    row.appendChild(iconWrap);
  }
  const body = el("div", "cc-lane__item-body");
  body.appendChild(el("span", "cc-lane__item-title", item.title));
  // Task items (Notion, Todoist, Google Tasks) share one secondary line built
  // from their structured fields, so all three read identically.
  const sub = item.task !== undefined ? taskSecondary(item.task) : (item.subtitle ?? item.meta);
  if (sub !== undefined) body.appendChild(el("span", "cc-lane__item-sub", sub));
  row.appendChild(body);
  return row;
}

/** Join the present task fields into one line: "due · priority · status · category". */
function taskSecondary(task: TaskFields): string | undefined {
  const parts = [task.due, task.priority, task.status, task.category].filter(
    (part): part is string => part !== undefined && part.length > 0,
  );
  return parts.length > 0 ? parts.join(" · ") : undefined;
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

function filterIcon(): SVGElement {
  const svg = svgEl("svg", {
    viewBox: "0 0 24 24",
    width: "15",
    height: "15",
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.8",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
  });
  svg.appendChild(svgEl("path", { d: "M4 6h16M7 12h10M10 18h4" }));
  return svg;
}

/**
 * The Tasks section, with a quiet filter/sort control in its header. Changing the
 * filter persists it (so it survives repaints) and re-renders just the list in
 * place, leaving the popover open; a full repaint reads the persisted state.
 */
function renderTasksSection(
  allTasks: LaneEntry[],
  model: NeedsYouLaneModel,
  deps: NeedsYouLaneDeps,
): HTMLElement {
  let state: TaskFilterState = model.taskFilter ?? { ...DEFAULT_TASK_FILTER };
  const statuses = distinctStatuses(allTasks);

  const section = el("div", "cc-lane__section cc-lane__section--tasks");
  const head = el("div", "cc-lane__section-head");
  head.appendChild(el("div", "cc-lane__label", "Tasks"));

  const filter = el("div", "cc-lane__filter");
  const button = el("button", "cc-lane__filter-btn");
  button.setAttribute("type", "button");
  button.setAttribute("aria-label", "Filter and sort tasks");
  button.setAttribute("aria-haspopup", "true");
  button.setAttribute("aria-expanded", "false");
  button.appendChild(filterIcon());

  const popover = el("div", "cc-lane__popover");
  popover.dataset.open = "false";
  popover.setAttribute("role", "group");
  popover.setAttribute("aria-label", "Task filter and sort");

  const list = el("div", "cc-lane__list");

  function renderList(): void {
    list.replaceChildren();
    const visible = applyTaskFilter(allTasks, state).slice(0, SECTION_LIMIT);
    if (visible.length === 0) {
      list.appendChild(el("div", "cc-lane__empty", "No tasks match this filter."));
      return;
    }
    for (const entry of visible) list.appendChild(renderLaneItem(entry, deps));
  }

  function persist(): void {
    deps.onTaskFilterChange?.(state);
    renderList();
  }

  if (statuses.length > 0) {
    popover.appendChild(el("div", "cc-lane__popover-label", "Status"));
    const boxes: Array<{ status: string; box: HTMLInputElement }> = [];
    for (const status of statuses) {
      const row = el("label", "cc-lane__option");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = state.statuses === undefined || state.statuses.includes(status);
      box.addEventListener("change", () => {
        const checked = boxes.filter((entry) => entry.box.checked).map((entry) => entry.status);
        state =
          checked.length === statuses.length
            ? { sort: state.sort }
            : { sort: state.sort, statuses: checked };
        persist();
      });
      row.appendChild(box);
      row.appendChild(el("span", undefined, status));
      popover.appendChild(row);
      boxes.push({ status, box });
    }
  }

  popover.appendChild(el("div", "cc-lane__popover-label", "Sort by due"));
  for (const [value, label] of [
    ["asc", "Soonest first"],
    ["desc", "Latest first"],
  ] as const) {
    const row = el("label", "cc-lane__option");
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "cc-task-sort";
    radio.checked = state.sort === value;
    radio.addEventListener("change", () => {
      if (radio.checked) {
        state = { ...state, sort: value };
        persist();
      }
    });
    row.appendChild(radio);
    row.appendChild(el("span", undefined, label));
    popover.appendChild(row);
  }

  let open = false;
  function setOpen(next: boolean): void {
    open = next;
    popover.dataset.open = String(next);
    button.setAttribute("aria-expanded", String(next));
    if (next) {
      document.addEventListener("click", onOutside);
      document.addEventListener("keydown", onEscape);
    } else {
      document.removeEventListener("click", onOutside);
      document.removeEventListener("keydown", onEscape);
    }
  }
  function onOutside(event: MouseEvent): void {
    if (!filter.contains(event.target as Node)) setOpen(false);
  }
  function onEscape(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      setOpen(false);
      button.focus();
    }
  }
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    setOpen(!open);
  });

  filter.appendChild(button);
  filter.appendChild(popover);
  head.appendChild(filter);
  section.appendChild(head);
  section.appendChild(list);
  renderList();
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
      ? buildLaneBuckets(
          collectEntries(model.integrationResults, model.streams, model.connections),
          model.now,
        )
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
    root.appendChild(renderTasksSection(buckets.tasks, model, deps));
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
