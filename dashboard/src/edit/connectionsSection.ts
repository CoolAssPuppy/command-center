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
            "No connections yet. Add one below, then build a Work stream from it.",
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
    }
    const calendarId = textInput("primary");
    calendarId.value = connection.calendarId ?? "";
    calendarId.setAttribute("aria-label", "Calendar id");
    calendarId.addEventListener("change", () => {
      updateConnection(ctx, connection.id, (item) => {
        const value = calendarId.value.trim();
        if (value.length > 0) item.calendarId = value;
        else delete item.calendarId;
      });
    });
    wrap.appendChild(field("Calendar id", calendarId));
  } else {
    const key = document.createElement("input");
    key.type = "password";
    key.className = "cc-edit__input";
    const keyLabel = connection.service === "linear" ? "Linear API key" : "Notion token";
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
    const database = textInput("Database id");
    database.value = connection.databaseId ?? "";
    database.setAttribute("aria-label", "Notion database id");
    database.addEventListener("change", () => {
      updateConnection(ctx, connection.id, (item) => {
        const value = database.value.trim();
        if (value.length > 0) item.databaseId = value;
        else delete item.databaseId;
      });
    });
    wrap.appendChild(field("Database id", database));
  }

  const count = textInput("10", "number");
  count.value = String(connection.count ?? (connection.service === "google-calendar" ? 6 : 10));
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
      const calendarId = textInput("primary");
      calendarId.setAttribute("aria-label", "Calendar id");
      targetInput = calendarId;
      fieldsBox.appendChild(field("Calendar id", calendarId));
      fieldsBox.appendChild(
        el(
          "div",
          "cc-edit__hint",
          "Add the connection, then connect your Google account on its row.",
        ),
      );
    } else if (service === "linear") {
      const key = secretField("Linear API key");
      secretInput = key;
      fieldsBox.appendChild(field("API key", key));
      fieldsBox.appendChild(
        el("div", "cc-edit__hint", "A personal API key from Linear settings. Stored locally."),
      );
    } else {
      const token = secretField("Notion token");
      secretInput = token;
      fieldsBox.appendChild(field("Token", token));
      const database = textInput("Database or page id");
      database.setAttribute("aria-label", "Notion database or page id");
      targetInput = database;
      fieldsBox.appendChild(field("Database or page", database));
    }
  };
  select.addEventListener("change", rebuildFields);
  rebuildFields();

  const submit = el("button", "cc-edit__add-btn", "Add connection");
  submit.setAttribute("type", "submit");

  form.appendChild(field("Service", select));
  form.appendChild(field("Name", name));
  form.appendChild(fieldsBox);
  form.appendChild(submit);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const nameValue = name.value.trim();
    if (nameValue.length === 0) return;
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
