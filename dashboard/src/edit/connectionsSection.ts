import type { Connection, Service } from "../config/schema";
import { el } from "../render/helpers";
import { brandIcon } from "../shell/brandIcons";
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
 * The Connections section: add named connections to a service (you can have
 * several of the same service, each with its own name, credential, and
 * settings), edit, reorder, and remove them. Credentials are secrets and go
 * through updateSecrets, keyed by connection id (Google uses chrome.identity).
 */
const SERVICE_LABELS: ReadonlyArray<readonly [Service, string]> = [
  ["github", "GitHub"],
  ["google-calendar", "Google Calendar"],
  ["google-tasks", "Google Tasks"],
  ["linear", "Linear"],
  ["notion", "Notion"],
  ["todoist", "Todoist"],
];

function serviceFromValue(value: string): Service {
  return SERVICE_LABELS.find(([id]) => id === value)?.[0] ?? "notion";
}

function updateConnection(
  ctx: SectionContext,
  id: string,
  mutate: (connection: Connection) => void,
): void {
  ctx.update((config) => {
    const found = config.connections.find((connection) => connection.id === id);
    if (found !== undefined) mutate(found);
  });
}

export function renderConnectionsSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    { title: "Connections", key: "connections", collapsed: ctx.collapsed },
    (section) => {
      const list = el("div", "cc-edit__list");
      ctx.draft.connections.forEach((connection, index) => {
        list.appendChild(renderConnectionRow(connection, index, ctx));
      });
      if (ctx.draft.connections.length === 0) {
        list.appendChild(
          el(
            "div",
            "cc-edit__hint",
            "No connections yet. Add one below, then build a Data card from it.",
          ),
        );
      }
      section.appendChild(list);
      section.appendChild(renderAddConnection(ctx));
    },
  );
}

function renderConnectionRow(
  connection: Connection,
  index: number,
  ctx: SectionContext,
): HTMLElement {
  const row = el("div", "cc-edit__row cc-edit__row--stack");

  const head = el("div", "cc-edit__row-head");
  const icon = brandIcon(connection.service);
  if (icon !== undefined) head.appendChild(icon);
  const name = textInput("Connection name");
  name.value = connection.name;
  name.setAttribute("aria-label", "Connection name");
  name.addEventListener("change", () => {
    updateConnection(ctx, connection.id, (item) => {
      if (name.value.trim().length > 0) item.name = name.value.trim();
    });
  });
  head.appendChild(name);

  const controls = el("div", "cc-edit__row-controls");
  controls.appendChild(
    iconButton("Remove", "✕", () => {
      ctx.update((config) => {
        config.connections = config.connections.filter((item) => item.id !== connection.id);
      });
    }),
  );
  head.appendChild(controls);
  row.appendChild(head);

  row.appendChild(renderConnectionFields(connection, ctx));

  makeReorderable({
    row,
    index,
    count: ctx.draft.connections.length,
    itemId: connection.id,
    itemNoun: "connection",
    handleHost: head,
    applyReorder: (from, to) =>
      ctx.update((config) => {
        reorderInArray(config.connections, from, to);
      }),
  });
  return row;
}

interface CalendarOption {
  id: string;
  summary?: string;
}

/**
 * Fetch the signed-in account's calendar list directly (googleapis.com is
 * permitted). Best-effort: returns undefined when fetch is unavailable, the
 * token is rejected, or the shape is unexpected, so the caller can fall back to
 * a plain calendar-id input.
 */
async function fetchCalendarList(accessToken: string): Promise<CalendarOption[] | undefined> {
  const globalFetch = (globalThis as { fetch?: typeof fetch }).fetch;
  if (globalFetch === undefined) return undefined;
  try {
    const response = await globalFetch(
      "https://www.googleapis.com/calendar/v3/users/me/calendarList",
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!response.ok) return undefined;
    const body = (await response.json()) as { items?: unknown };
    if (!Array.isArray(body.items)) return undefined;
    const options: CalendarOption[] = [];
    for (const raw of body.items) {
      if (typeof raw !== "object" || raw === null) continue;
      const item = raw as { id?: unknown; summary?: unknown };
      if (typeof item.id !== "string") continue;
      options.push(
        typeof item.summary === "string"
          ? { id: item.id, summary: item.summary }
          : { id: item.id },
      );
    }
    return options;
  } catch {
    return undefined;
  }
}

/** The plain calendar-id text input, used when the live list cannot be fetched. */
function calendarIdInput(connection: Connection, ctx: SectionContext): HTMLInputElement {
  const input = textInput("primary");
  input.value = connection.calendarId ?? "";
  input.setAttribute("aria-label", "Calendar id");
  input.addEventListener("change", () => {
    updateConnection(ctx, connection.id, (item) => {
      const value = input.value.trim();
      if (value.length > 0) item.calendarId = value;
      else delete item.calendarId;
    });
  });
  return input;
}

/** The calendars currently selected: calendarIds when set, else the default. */
function selectedCalendarIds(connection: Connection): Set<string> {
  if (connection.calendarIds !== undefined && connection.calendarIds.length > 0) {
    return new Set(connection.calendarIds);
  }
  return new Set([connection.calendarId ?? "primary"]);
}

/**
 * The calendar picker: a checklist of the account's real calendars (pick as many
 * as you like) when connected, populated async with a "Loading calendars…"
 * placeholder. The chosen ids are stored in connection.calendarIds. Falls back to
 * a single plain id input when there is no token or the fetch fails.
 */
/**
 * Whether each connection's calendar disclosure is open, kept across the pane's
 * re-renders (checking a calendar re-renders the whole pane). Keyed by
 * connection id; absent means collapsed, the default.
 */
const expandedCalendars = new Set<string>();

function renderCalendarPicker(
  wrap: HTMLElement,
  connection: Connection,
  ctx: SectionContext,
  accessToken: string | undefined,
): void {
  if (accessToken === undefined) {
    const fieldWrap = el("div", "cc-edit__field cc-edit__calendars");
    fieldWrap.appendChild(el("label", "cc-edit__field-label", "Calendars"));
    fieldWrap.appendChild(calendarIdInput(connection, ctx));
    wrap.appendChild(fieldWrap);
    return;
  }

  // A chevron disclosure so the calendar list stays out of the way until needed.
  const details = document.createElement("details");
  details.className = "cc-edit__field cc-edit__calendars cc-edit__calendars-disclosure";
  details.open = expandedCalendars.has(connection.id);
  details.addEventListener("toggle", () => {
    if (details.open) expandedCalendars.add(connection.id);
    else expandedCalendars.delete(connection.id);
  });
  const summary = document.createElement("summary");
  summary.className = "cc-edit__calendars-summary";
  const selectedCount = selectedCalendarIds(connection).size;
  const chevron = el("span", "cc-edit__calendars-chevron", "›");
  chevron.setAttribute("aria-hidden", "true");
  summary.appendChild(chevron);
  summary.appendChild(
    el("span", undefined, `Calendars · ${String(selectedCount)} selected`),
  );
  details.appendChild(summary);

  const listBox = el("div", "cc-edit__calendar-list");
  listBox.appendChild(el("div", "cc-edit__hint", "Loading calendars…"));
  details.appendChild(listBox);
  wrap.appendChild(details);

  void fetchCalendarList(accessToken).then((calendars) => {
    if (calendars === undefined || calendars.length === 0) {
      // No list available; fall back to a single plain calendar-id input.
      const fieldWrap = el("div", "cc-edit__field cc-edit__calendars");
      fieldWrap.appendChild(el("label", "cc-edit__field-label", "Calendar"));
      fieldWrap.appendChild(calendarIdInput(connection, ctx));
      details.replaceWith(fieldWrap);
      return;
    }
    listBox.replaceChildren();
    const selected = selectedCalendarIds(connection);
    const boxes: Array<{ id: string; box: HTMLInputElement }> = [];
    for (const calendar of calendars) {
      const row = el("label", "cc-edit__check");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = selected.has(calendar.id);
      box.addEventListener("change", () => {
        const checked = boxes.filter((entry) => entry.box.checked).map((entry) => entry.id);
        updateConnection(ctx, connection.id, (item) => {
          if (checked.length > 0) item.calendarIds = checked;
          else delete item.calendarIds;
        });
      });
      row.appendChild(box);
      row.appendChild(el("span", undefined, calendar.summary ?? calendar.id));
      listBox.appendChild(row);
      boxes.push({ id: calendar.id, box });
    }
  });
}

function renderConnectionFields(
  connection: Connection,
  ctx: SectionContext,
): HTMLElement {
  const wrap = el("div", "cc-edit__nested");

  if (connection.service === "google-calendar" || connection.service === "google-tasks") {
    const connect = ctx.runtime.connectGoogleAccount;
    const connected = ctx.draftSecrets.googleTokens[connection.id];

    if (connected !== undefined) {
      // Connected: show the account email and a Disconnect link that clears the
      // token, reverting the row to a Connect button on re-render.
      const accountRow = el("div", "cc-edit__account");
      accountRow.appendChild(el("span", "cc-edit__account-email", connected.email ?? "Connected"));
      const disconnect = el("button", "cc-edit__link-btn", "Disconnect");
      disconnect.setAttribute("type", "button");
      disconnect.addEventListener("click", () => {
        ctx.updateSecrets((secrets) => {
          delete secrets.googleTokens[connection.id];
        });
      });
      accountRow.appendChild(disconnect);
      wrap.appendChild(field("Account", accountRow));
    } else if (connect !== undefined) {
      const button = el("button", "cc-edit__add-btn", "Connect Google account");
      button.setAttribute("type", "button");
      button.addEventListener("click", () => {
        void connect(connection.id).then((token) => {
          if (token !== undefined) {
            ctx.updateSecrets((secrets) => {
              secrets.googleTokens[connection.id] = token;
            });
          }
        });
      });
      wrap.appendChild(field("Account", button));
    } else {
      wrap.appendChild(
        el(
          "div",
          "cc-edit__hint",
          "Google sign-in works only in the installed extension with sign-in configured. Load the unpacked extension to connect.",
        ),
      );
    }

    if (connection.service === "google-calendar") {
      renderCalendarPicker(wrap, connection, ctx, connected?.accessToken);
    }
  } else {
    const key = document.createElement("input");
    key.type = "password";
    key.className = "cc-edit__input";
    const placeholders: Partial<Record<Service, string>> = {
      linear: "Linear API key",
      github: "GitHub token",
      notion: "Notion token",
      todoist: "Todoist API token",
    };
    const keyLabel = placeholders[connection.service] ?? "Token";
    key.placeholder = keyLabel;
    key.setAttribute("aria-label", keyLabel);
    key.value = ctx.draftSecrets.connectionSecrets[connection.id] ?? "";
    key.addEventListener("change", () => {
      ctx.updateSecrets((secrets) => {
        const value = key.value.trim();
        if (value.length > 0) secrets.connectionSecrets[connection.id] = value;
        else delete secrets.connectionSecrets[connection.id];
      });
    });
    wrap.appendChild(field(connection.service === "linear" ? "API key" : "Token", key));
  }

  if (connection.service === "notion") {
    const database = textInput("Database URL or id");
    database.value = connection.databaseId ?? "";
    database.setAttribute("aria-label", "Notion database URL or id");
    database.addEventListener("change", () => {
      updateConnection(ctx, connection.id, (item) => {
        const value = database.value.trim();
        if (value.length > 0) item.databaseId = value;
        else delete item.databaseId;
      });
    });
    wrap.appendChild(field("Database", database));
  }

  if (connection.service === "github") {
    const query = textInput("is:open is:pr review-requested:@me");
    query.value = connection.query ?? "";
    query.setAttribute("aria-label", "GitHub search query");
    query.addEventListener("change", () => {
      updateConnection(ctx, connection.id, (item) => {
        const value = query.value.trim();
        if (value.length > 0) item.query = value;
        else delete item.query;
      });
    });
    wrap.appendChild(
      fieldWithHelp(
        "Search",
        query,
        "Blank shows PRs awaiting your review. Try is:open is:pr author:@me for your own, or is:open assignee:@me for issues.",
      ),
    );
  }

  // Linear: pick which pre-defined view this connection reads.
  if (connection.service === "linear") {
    const views: ReadonlyArray<readonly [NonNullable<Connection["linearView"]>, string]> = [
      ["assigned", "Assigned to me"],
      ["created", "Created by me"],
      ["in-progress", "In progress"],
      ["due", "Due soon"],
      ["recent", "Recently updated"],
      ["inbox", "Inbox"],
      ["projects", "Projects"],
      ["initiatives", "Initiatives"],
    ];
    const view = document.createElement("select");
    view.className = "cc-edit__input";
    view.setAttribute("aria-label", "Linear view");
    for (const [value, label] of views) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      if ((connection.linearView ?? "assigned") === value) option.selected = true;
      view.appendChild(option);
    }
    view.addEventListener("change", () => {
      const next = views.find(([value]) => value === view.value)?.[0] ?? "assigned";
      updateConnection(ctx, connection.id, (item) => {
        // "assigned" is the default, so it is left implicit to keep configs clean.
        if (next === "assigned") delete item.linearView;
        else item.linearView = next;
      });
    });
    wrap.appendChild(field("View", view));
  }

  // Task-capable sources choose whether their items also enter the left lane.
  if (
    connection.service === "notion" ||
    connection.service === "todoist" ||
    connection.service === "google-tasks"
  ) {
    const defaultRole = connection.service === "google-tasks" ? "tasks" : "reference";
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
      if ((connection.role ?? defaultRole) === value) option.selected = true;
      role.appendChild(option);
    }
    role.addEventListener("change", () => {
      updateConnection(ctx, connection.id, (item) => {
        item.role = role.value === "tasks" ? "tasks" : "reference";
      });
    });
    wrap.appendChild(field("Role", role));
  }

  const count = textInput("6", "number");
  count.value = String(connection.count ?? 6);
  count.setAttribute("aria-label", "Item count");
  count.addEventListener("change", () => {
    updateConnection(ctx, connection.id, (item) => {
      const parsed = Number(count.value);
      if (Number.isFinite(parsed) && parsed > 0) item.count = Math.min(50, Math.floor(parsed));
    });
  });
  wrap.appendChild(field("Items", count));

  return wrap;
}

/** A password field for a credential (Linear key / Notion token). */
function secretField(placeholder: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "password";
  input.className = "cc-edit__input";
  input.placeholder = placeholder;
  input.setAttribute("aria-label", placeholder);
  return input;
}

/**
 * Add a connection. The service drop-down comes first; the fields below it
 * change to match the chosen service, since each needs different setup (Google
 * connects its account afterwards, Linear takes an API key, Notion a token plus
 * the database or page to pull from). On submit the connection and its secret
 * are created together.
 */
function renderAddConnection(ctx: SectionContext): HTMLElement {
  const wrap = el("div", "cc-edit__add");
  const form = el("form", "cc-edit__add-form cc-edit__add-form--stack");

  const select = document.createElement("select");
  select.className = "cc-edit__input";
  select.setAttribute("aria-label", "Service");
  for (const [value, label] of SERVICE_LABELS) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  const name = textInput("Connection name (e.g. Work Calendar)");
  name.setAttribute("aria-label", "New connection name");

  // Rebuilt whenever the service changes; holds that service's setup fields.
  const fieldsBox = el("div", "cc-edit__add-fields");
  let secretInput: HTMLInputElement | undefined;
  let targetInput: HTMLInputElement | undefined;

  const rebuildFields = (): void => {
    fieldsBox.replaceChildren();
    secretInput = undefined;
    targetInput = undefined;
    const service = serviceFromValue(select.value);

    if (service === "google-calendar" || service === "google-tasks") {
      fieldsBox.appendChild(
        el(
          "div",
          "cc-edit__hint",
          service === "google-tasks"
            ? "No setup here. Add it, then connect your Google account on its row; it reads your task lists."
            : "No setup here. Add it, then connect your Google account on its row; it reads your main calendar.",
        ),
      );
    } else if (service === "linear") {
      const key = secretField("Linear API key");
      secretInput = key;
      fieldsBox.appendChild(field("API key", key));
      fieldsBox.appendChild(
        el("div", "cc-edit__hint", "A personal API key from Linear settings. Stored locally."),
      );
    } else if (service === "github") {
      const token = secretField("GitHub token (github_pat_… or ghp_…)");
      secretInput = token;
      fieldsBox.appendChild(field("Token", token));
      const query = textInput("is:open is:pr review-requested:@me");
      query.setAttribute("aria-label", "GitHub search query");
      targetInput = query;
      fieldsBox.appendChild(field("Search (optional)", query));
      fieldsBox.appendChild(
        el(
          "div",
          "cc-edit__hint",
          "A fine-grained personal access token with read access to pull requests and issues. Stored locally. Leave search blank for PRs awaiting your review.",
        ),
      );
    } else if (service === "todoist") {
      const token = secretField("Todoist API token");
      secretInput = token;
      fieldsBox.appendChild(field("API token", token));
      fieldsBox.appendChild(
        el(
          "div",
          "cc-edit__hint",
          "From Todoist settings, Integrations, Developer. Stored locally. Tasks show in the Needs you column.",
        ),
      );
    } else {
      const token = secretField("Notion token (starts with ntn_)");
      secretInput = token;
      fieldsBox.appendChild(field("Token", token));
      const database = textInput("Paste the database URL");
      database.setAttribute("aria-label", "Notion database URL or id");
      targetInput = database;
      fieldsBox.appendChild(field("Database", database));
      fieldsBox.appendChild(
        el(
          "div",
          "cc-edit__hint",
          "Paste the database's link; the app uses the id before ?v= (the ?v= part is a view, not the database). Make an internal integration at notion.so/my-integrations and share the database with it.",
        ),
      );
    }
  };
  select.addEventListener("change", rebuildFields);
  rebuildFields();

  const submit = el("button", "cc-edit__add-btn", "Add connection");
  submit.setAttribute("type", "submit");

  const error = el("div", "cc-edit__hint");

  form.appendChild(field("Service", select));
  form.appendChild(field("Name", name));
  form.appendChild(fieldsBox);
  form.appendChild(submit);
  form.appendChild(error);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.replaceChildren();
    const nameValue = name.value.trim();
    if (nameValue.length === 0) {
      error.appendChild(el("span", undefined, "Give the connection a name first."));
      return;
    }
    const service = serviceFromValue(select.value);
    const id = newId("conn");
    const target = targetInput?.value.trim();
    const secret = secretInput?.value.trim();

    ctx.update((config) => {
      const connection: Connection = { id, name: nameValue, service };
      if (service === "google-calendar" && target !== undefined && target.length > 0) {
        connection.calendarId = target;
      }
      if (service === "notion" && target !== undefined && target.length > 0) {
        connection.databaseId = target;
      }
      if (service === "github" && target !== undefined && target.length > 0) {
        connection.query = target;
      }
      config.connections.push(connection);
    });
    if (secret !== undefined && secret.length > 0) {
      ctx.updateSecrets((secrets) => {
        secrets.connectionSecrets[id] = secret;
      });
    }
  });

  wrap.appendChild(form);
  return wrap;
}
