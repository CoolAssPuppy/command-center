import type { Connection, Service } from "../config/schema";
import { el } from "../render/helpers";
import { brandIcon } from "../shell/brandIcons";
import { newId } from "../util/id";
import {
  collapsibleSection,
  field,
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
  ["google-calendar", "Google Calendar"],
  ["linear", "Linear"],
  ["notion", "Notion"],
  ["github", "GitHub"],
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

function renderConnectionFields(
  connection: Connection,
  ctx: SectionContext,
): HTMLElement {
  const wrap = el("div", "cc-edit__nested");

  if (connection.service === "google-calendar") {
    const connect = ctx.runtime.connectGoogle;
    if (connect !== undefined) {
      const button = el("button", "cc-edit__add-btn", "Connect Google");
      button.setAttribute("type", "button");
      button.addEventListener("click", () => {
        void connect();
      });
      wrap.appendChild(field("Account", button));
    } else {
      wrap.appendChild(
        el(
          "div",
          "cc-edit__hint",
          "Google sign-in works only in the installed extension, not the dev server. Load the unpacked extension to connect.",
        ),
      );
    }
    const calendarId = textInput("primary");
    calendarId.value = connection.calendarId ?? "";
    calendarId.setAttribute("aria-label", "Calendar");
    calendarId.addEventListener("change", () => {
      updateConnection(ctx, connection.id, (item) => {
        const value = calendarId.value.trim();
        if (value.length > 0) item.calendarId = value;
        else delete item.calendarId;
      });
    });
    wrap.appendChild(field("Calendar (optional)", calendarId));
    wrap.appendChild(
      el(
        "div",
        "cc-edit__hint",
        "Leave blank for your main calendar. For another, paste its ID from Google Calendar settings, Integrate calendar.",
      ),
    );

    const merge = document.createElement("textarea");
    merge.className = "cc-edit__input cc-edit__textarea";
    merge.rows = 3;
    merge.placeholder = "Paste a calendar link or id, one per line";
    merge.value = (connection.calendarIds ?? []).join("\n");
    merge.setAttribute("aria-label", "Calendars to merge");
    merge.addEventListener("change", () => {
      updateConnection(ctx, connection.id, (item) => {
        const lines = merge.value
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0);
        if (lines.length > 0) item.calendarIds = lines;
        else delete item.calendarIds;
      });
    });
    wrap.appendChild(field("Merge calendars (optional)", merge));
    wrap.appendChild(
      el(
        "div",
        "cc-edit__hint",
        "Paste a calendar's share link or id, one per line, to merge its events into this card. From Google Calendar settings, Integrate calendar, copy the Public URL, the Embed src, or the Calendar ID. You can only see calendars your signed-in account can access.",
      ),
    );
  } else {
    const key = document.createElement("input");
    key.type = "password";
    key.className = "cc-edit__input";
    const placeholders: Partial<Record<Service, string>> = {
      linear: "Linear API key",
      github: "GitHub token",
      notion: "Notion token",
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
    wrap.appendChild(field("Search", query));
    wrap.appendChild(
      el(
        "div",
        "cc-edit__hint",
        "A GitHub search. Blank shows pull requests awaiting your review. Try is:open is:pr author:@me for your own, or is:open assignee:@me for issues.",
      ),
    );
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

    if (service === "google-calendar") {
      fieldsBox.appendChild(
        el(
          "div",
          "cc-edit__hint",
          "No setup here. Add it, then connect your Google account on its row; it reads your main calendar.",
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
      // Also create a work stream for it, so the connection shows on the
      // dashboard right away. It can be renamed, removed, or joined by more.
      config.streams.push({
        id: newId("stream"),
        title: nameValue,
        connectionId: id,
        collapsedByDefault: false,
      });
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
