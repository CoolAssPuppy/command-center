import {
  COMBINED_CALENDARS_ID,
  type CombineCalendarRef,
  type Connection,
  type Service,
  type Stream,
} from "../config/schema";
import {
  fetchGoogleCalendarList,
  type CalendarListEntry,
} from "../integrations/googleCalendarList";
import { realHttpFetch } from "../integrations/http";
import { el } from "../render/helpers";
import { newId } from "../util/id";
import {
  collapsibleSection,
  field,
  fieldWithHelp,
  iconButton,
  reorderInArray,
  textInput,
} from "./controls";
import type { SectionContext } from "./editPane";
import { makeReorderable } from "./reorderable";

/**
 * The Data Cards section: each card picks a base connection and customizes it.
 * Here you set the card's title, base connection, and the per-source options
 * (Linear view, GitHub query, Notion database + role, the calendar selection,
 * Todoist/Google-Tasks role, item count). Needs at least one connection first.
 */
function connectionSelect(
  connections: Connection[],
  selectedId: string | undefined,
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "cc-edit__input";
  select.setAttribute("aria-label", "Connection");
  for (const connection of connections) {
    const option = document.createElement("option");
    option.value = connection.id;
    option.textContent = connection.name;
    if (connection.id === selectedId) option.selected = true;
    select.appendChild(option);
  }
  // Offer merging every calendar once there is more than one to merge.
  const calendarCount = connections.filter(
    (connection) => connection.service === "google-calendar",
  ).length;
  if (calendarCount >= 2) {
    const option = document.createElement("option");
    option.value = COMBINED_CALENDARS_ID;
    option.textContent = "Combine all calendars";
    if (selectedId === COMBINED_CALENDARS_ID) option.selected = true;
    select.appendChild(option);
  }
  return select;
}

function updateStream(
  ctx: SectionContext,
  id: string,
  mutate: (stream: Stream) => void,
): void {
  ctx.update((config) => {
    const found = config.streams.find((stream) => stream.id === id);
    if (found !== undefined) mutate(found);
  });
}

export function renderStreamsSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    {
      title: "Data cards",
      key: "streams",
      collapsed: ctx.collapsed,
      description: "The cards shown on your new tab.",
    },
    (section) => {
      if (ctx.draft.connections.length === 0) {
        section.appendChild(
          el(
            "div",
            "cc-edit__hint",
            "Add a Connection first, then create a Data card that shows it.",
          ),
        );
        return;
      }

      const list = el("div", "cc-edit__list");
      ctx.draft.streams.forEach((stream, index) => {
        list.appendChild(renderStreamRow(stream, index, ctx));
      });
      if (ctx.draft.streams.length === 0) {
        list.appendChild(el("div", "cc-edit__hint", "No data cards yet. Add one below."));
      }
      section.appendChild(list);
      section.appendChild(renderAddStream(ctx));
    },
  );
}

function renderStreamRow(stream: Stream, index: number, ctx: SectionContext): HTMLElement {
  const row = el("div", "cc-edit__row cc-edit__row--stack");

  const head = el("div", "cc-edit__row-head");
  const title = textInput("Card title");
  title.value = stream.title;
  title.setAttribute("aria-label", "Card title");
  title.addEventListener("change", () => {
    updateStream(ctx, stream.id, (item) => {
      if (title.value.trim().length > 0) item.title = title.value.trim();
    });
  });
  head.appendChild(title);

  const controls = el("div", "cc-edit__row-controls");
  controls.appendChild(
    iconButton("Remove", "✕", () => {
      ctx.update((config) => {
        config.streams = config.streams.filter((item) => item.id !== stream.id);
      });
    }),
  );
  head.appendChild(controls);
  row.appendChild(head);

  const nested = el("div", "cc-edit__nested");
  const select = connectionSelect(ctx.draft.connections, stream.connectionId);
  select.addEventListener("change", () => {
    updateStream(ctx, stream.id, (item) => {
      item.connectionId = select.value;
    });
  });
  nested.appendChild(field("Connection", select));
  renderCardConfig(nested, stream, ctx);
  row.appendChild(nested);

  makeReorderable({
    row,
    index,
    count: ctx.draft.streams.length,
    itemId: stream.id,
    itemNoun: "data card",
    handleHost: head,
    applyReorder: (from, to) =>
      ctx.update((config) => {
        reorderInArray(config.streams, from, to);
      }),
  });
  return row;
}

/** Append the per-source customization for a card, branching by base service. */
function renderCardConfig(wrap: HTMLElement, stream: Stream, ctx: SectionContext): void {
  if (stream.connectionId === COMBINED_CALENDARS_ID) {
    renderCombineCalendarPicker(wrap, stream, ctx);
    wrap.appendChild(countField(stream, ctx));
    return;
  }
  const connection = ctx.draft.connections.find((item) => item.id === stream.connectionId);
  if (connection === undefined) return;
  const service = connection.service;

  if (service === "linear") wrap.appendChild(linearViewField(stream, ctx));
  if (service === "github") wrap.appendChild(githubSearchField(stream, ctx));
  if (service === "notion") wrap.appendChild(notionDatabaseField(stream, ctx));
  if (service === "google-calendar") renderCalendarPicker(wrap, stream, ctx, connection.id);
  if (service === "notion" || service === "todoist" || service === "google-tasks") {
    wrap.appendChild(roleField(stream, ctx, service));
  }
  wrap.appendChild(countField(stream, ctx));
}

function countField(stream: Stream, ctx: SectionContext): HTMLElement {
  const count = textInput("6", "number");
  count.value = String(stream.count ?? 6);
  count.setAttribute("aria-label", "Item count");
  count.addEventListener("change", () => {
    updateStream(ctx, stream.id, (item) => {
      const parsed = Number(count.value);
      if (Number.isFinite(parsed) && parsed > 0) item.count = Math.min(50, Math.floor(parsed));
    });
  });
  return field("Items", count);
}

const LINEAR_VIEWS: ReadonlyArray<readonly [NonNullable<Stream["linearView"]>, string]> = [
  ["assigned", "Assigned to me"],
  ["created", "Created by me"],
  ["in-progress", "In progress"],
  ["due", "Due soon"],
  ["recent", "Recently updated"],
  ["inbox", "Inbox"],
  ["projects", "Projects"],
  ["initiatives", "Initiatives"],
];

function linearViewField(stream: Stream, ctx: SectionContext): HTMLElement {
  const view = document.createElement("select");
  view.className = "cc-edit__input";
  view.setAttribute("aria-label", "Linear view");
  for (const [value, label] of LINEAR_VIEWS) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if ((stream.linearView ?? "assigned") === value) option.selected = true;
    view.appendChild(option);
  }
  view.addEventListener("change", () => {
    const next = LINEAR_VIEWS.find(([value]) => value === view.value)?.[0] ?? "assigned";
    updateStream(ctx, stream.id, (item) => {
      if (next === "assigned") delete item.linearView;
      else item.linearView = next;
    });
  });
  return field("View", view);
}

function githubSearchField(stream: Stream, ctx: SectionContext): HTMLElement {
  const query = textInput("is:open is:pr review-requested:@me");
  query.value = stream.query ?? "";
  query.setAttribute("aria-label", "GitHub search query");
  query.addEventListener("change", () => {
    updateStream(ctx, stream.id, (item) => {
      const value = query.value.trim();
      if (value.length > 0) item.query = value;
      else delete item.query;
    });
  });
  return fieldWithHelp(
    "Search",
    query,
    "Blank shows PRs awaiting your review. Try is:open is:pr author:@me for your own, or is:open assignee:@me for issues.",
  );
}

function notionDatabaseField(stream: Stream, ctx: SectionContext): HTMLElement {
  const database = textInput("Database URL or id");
  database.value = stream.databaseId ?? "";
  database.setAttribute("aria-label", "Notion database URL or id");
  database.addEventListener("change", () => {
    updateStream(ctx, stream.id, (item) => {
      const value = database.value.trim();
      if (value.length > 0) item.databaseId = value;
      else delete item.databaseId;
    });
  });
  return field("Database", database);
}

function roleField(stream: Stream, ctx: SectionContext, service: Service): HTMLElement {
  const defaultRole = service === "google-tasks" ? "tasks" : "reference";
  const role = document.createElement("select");
  role.className = "cc-edit__input";
  role.setAttribute("aria-label", "Role");
  for (const [value, label] of [
    ["reference", "Reference (data card only)"],
    ["tasks", "Tasks (show in Needs you)"],
  ] as const) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    if ((stream.role ?? defaultRole) === value) option.selected = true;
    role.appendChild(option);
  }
  role.addEventListener("change", () => {
    updateStream(ctx, stream.id, (item) => {
      item.role = role.value === "tasks" ? "tasks" : "reference";
    });
  });
  return field("Role", role);
}

function calendarIdInput(stream: Stream, ctx: SectionContext): HTMLInputElement {
  const input = textInput("primary");
  input.value = stream.calendarId ?? "";
  input.setAttribute("aria-label", "Calendar id");
  input.addEventListener("change", () => {
    updateStream(ctx, stream.id, (item) => {
      const value = input.value.trim();
      if (value.length > 0) item.calendarId = value;
      else delete item.calendarId;
    });
  });
  return input;
}

function selectedCalendarIds(stream: Stream): Set<string> {
  if (stream.calendarIds !== undefined && stream.calendarIds.length > 0) {
    return new Set(stream.calendarIds);
  }
  return new Set([stream.calendarId ?? "primary"]);
}

/** Card calendar disclosure open-state, kept across the pane's re-renders. */
const expandedCalendars = new Set<string>();

function renderCalendarPicker(
  wrap: HTMLElement,
  stream: Stream,
  ctx: SectionContext,
  connectionId: string,
): void {
  const accessToken = ctx.draftSecrets.googleTokens[connectionId]?.accessToken;
  if (accessToken === undefined) {
    const fieldWrap = el("div", "cc-edit__field cc-edit__calendars");
    fieldWrap.appendChild(el("label", "cc-edit__field-label", "Calendar"));
    fieldWrap.appendChild(calendarIdInput(stream, ctx));
    wrap.appendChild(fieldWrap);
    return;
  }

  const details = document.createElement("details");
  details.className = "cc-edit__field cc-edit__calendars cc-edit__calendars-disclosure";
  details.open = expandedCalendars.has(stream.id);
  details.addEventListener("toggle", () => {
    if (details.open) expandedCalendars.add(stream.id);
    else expandedCalendars.delete(stream.id);
  });
  const summary = document.createElement("summary");
  summary.className = "cc-edit__calendars-summary";
  const chevron = el("span", "cc-edit__calendars-chevron", "›");
  chevron.setAttribute("aria-hidden", "true");
  summary.appendChild(chevron);
  summary.appendChild(
    el("span", undefined, `Calendars · ${String(selectedCalendarIds(stream).size)} selected`),
  );
  details.appendChild(summary);

  const listBox = el("div", "cc-edit__calendar-list");
  listBox.appendChild(el("div", "cc-edit__hint", "Loading calendars…"));
  details.appendChild(listBox);
  wrap.appendChild(details);

  void fetchGoogleCalendarList(realHttpFetch, accessToken).then((calendars) => {
    if (calendars === undefined || calendars.length === 0) {
      const fieldWrap = el("div", "cc-edit__field cc-edit__calendars");
      fieldWrap.appendChild(el("label", "cc-edit__field-label", "Calendar"));
      fieldWrap.appendChild(calendarIdInput(stream, ctx));
      details.replaceWith(fieldWrap);
      return;
    }
    listBox.replaceChildren();
    const selected = selectedCalendarIds(stream);
    const boxes: Array<{ id: string; box: HTMLInputElement }> = [];
    for (const calendar of calendars) {
      const optionRow = el("label", "cc-edit__check");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = selected.has(calendar.id);
      box.addEventListener("change", () => {
        const checked = boxes.filter((entry) => entry.box.checked).map((entry) => entry.id);
        updateStream(ctx, stream.id, (item) => {
          if (checked.length > 0) item.calendarIds = checked;
          else delete item.calendarIds;
        });
      });
      optionRow.appendChild(box);
      optionRow.appendChild(el("span", undefined, calendar.summary ?? calendar.id));
      listBox.appendChild(optionRow);
      boxes.push({ id: calendar.id, box });
    }
  });
}

/** Qualified keys of the calendars a Combine card has selected. */
function selectedCombineKeys(stream: Stream): Set<string> {
  return new Set(
    (stream.combineCalendars ?? []).map((ref) => `${ref.connectionId} ${ref.calendarId}`),
  );
}

/**
 * The "Combine all calendars" card's picker: a chevron disclosure that pools the
 * calendars from every connected Google account, labelled by account, as a
 * multi-select. An empty selection means every calendar, so checking all (or
 * none) clears it back to that "all accounts" default.
 */
function renderCombineCalendarPicker(
  wrap: HTMLElement,
  stream: Stream,
  ctx: SectionContext,
): void {
  const accounts = ctx.draft.connections
    .filter((connection) => connection.service === "google-calendar")
    .map((connection) => ({
      connection,
      token: ctx.draftSecrets.googleTokens[connection.id]?.accessToken,
    }))
    .filter((entry): entry is { connection: Connection; token: string } =>
      entry.token !== undefined,
    );

  if (accounts.length === 0) {
    wrap.appendChild(
      el("div", "cc-edit__hint", "Connect a Google account to choose which calendars to merge."),
    );
    return;
  }

  const selection = selectedCombineKeys(stream);
  const details = document.createElement("details");
  details.className = "cc-edit__field cc-edit__calendars cc-edit__calendars-disclosure";
  details.open = expandedCalendars.has(stream.id);
  details.addEventListener("toggle", () => {
    if (details.open) expandedCalendars.add(stream.id);
    else expandedCalendars.delete(stream.id);
  });
  const summary = document.createElement("summary");
  summary.className = "cc-edit__calendars-summary";
  const chevron = el("span", "cc-edit__calendars-chevron", "›");
  chevron.setAttribute("aria-hidden", "true");
  summary.appendChild(chevron);
  const label = selection.size === 0 ? "All calendars" : `${String(selection.size)} selected`;
  summary.appendChild(el("span", undefined, `Calendars · ${label}`));
  details.appendChild(summary);

  const listBox = el("div", "cc-edit__calendar-list");
  listBox.appendChild(el("div", "cc-edit__hint", "Loading calendars…"));
  details.appendChild(listBox);
  wrap.appendChild(details);

  void Promise.all(
    accounts.map((account) =>
      fetchGoogleCalendarList(realHttpFetch, account.token).then((calendars) => ({
        connection: account.connection,
        calendars,
      })),
    ),
  ).then((results) => {
    listBox.replaceChildren();
    const boxes: Array<{ ref: CombineCalendarRef; box: HTMLInputElement }> = [];
    const commit = (): void => {
      const checked = boxes.filter((entry) => entry.box.checked);
      updateStream(ctx, stream.id, (item) => {
        // None or all checked both mean "every calendar from every account", so
        // clear the field; otherwise store the explicit qualified selection.
        if (checked.length === 0 || checked.length === boxes.length) delete item.combineCalendars;
        else item.combineCalendars = checked.map((entry) => entry.ref);
      });
    };

    for (const { connection, calendars } of results) {
      if (calendars === undefined || calendars.length === 0) continue;
      listBox.appendChild(el("div", "cc-edit__calendar-account", connection.name));
      for (const calendar of calendars) {
        const ref: CombineCalendarRef = { connectionId: connection.id, calendarId: calendar.id };
        const key = `${connection.id} ${calendar.id}`;
        const optionRow = el("label", "cc-edit__check");
        const box = document.createElement("input");
        box.type = "checkbox";
        box.checked = selection.size === 0 || selection.has(key);
        box.addEventListener("change", commit);
        optionRow.appendChild(box);
        optionRow.appendChild(el("span", undefined, calendarLabel(calendar)));
        listBox.appendChild(optionRow);
        boxes.push({ ref, box });
      }
    }
    if (boxes.length === 0) {
      listBox.appendChild(el("div", "cc-edit__hint", "No calendars found on the connected accounts."));
    }
  });
}

function calendarLabel(calendar: CalendarListEntry): string {
  return calendar.summary ?? calendar.id;
}

function renderAddStream(ctx: SectionContext): HTMLElement {
  const wrap = el("div", "cc-edit__add");
  const form = el("form", "cc-edit__add-form cc-edit__add-form--stack");

  const select = connectionSelect(ctx.draft.connections, ctx.draft.connections[0]?.id);
  const title = textInput("Card title");
  title.setAttribute("aria-label", "New data card title");

  const submit = el("button", "cc-edit__add-btn", "Add card");
  submit.setAttribute("type", "submit");

  form.appendChild(field("Connection", select));
  form.appendChild(field("Title", title));
  form.appendChild(submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = title.value.trim();
    const connectionId = select.value;
    if (value.length === 0 || connectionId.length === 0) return;
    ctx.update((config) => {
      // New cards land at the end of the right column on the surface; the user
      // drags them where they want. Pane list order is separate (cosmetic).
      const rightOrders = config.streams
        .filter((stream) => stream.column === "right")
        .map((stream) => stream.order);
      const nextOrder = rightOrders.length > 0 ? Math.max(...rightOrders) + 1 : 0;
      config.streams.push({
        id: newId("stream"),
        title: value,
        connectionId,
        collapsedByDefault: false,
        column: "right",
        order: nextOrder,
      });
    });
  });

  wrap.appendChild(el("div", "cc-edit__add-title", "Add a new data card"));
  wrap.appendChild(form);
  return wrap;
}
