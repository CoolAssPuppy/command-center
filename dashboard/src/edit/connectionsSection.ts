import type { Connection, Service } from "../config/schema";
import { el } from "../render/helpers";
import { brandIcon } from "../shell/brandIcons";
import { newId } from "../util/id";
import {
  collapsibleSection,
  field,
  iconButton,
  moveInArray,
  textInput,
} from "./controls";
import type { SectionContext } from "./editPane";

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
    iconButton("Move up", "↑", () => {
      ctx.update((config) => {
        moveInArray(config.connections, index, -1);
      });
    }),
  );
  controls.appendChild(
    iconButton("Move down", "↓", () => {
      ctx.update((config) => {
        moveInArray(config.connections, index, 1);
      });
    }),
  );
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

function renderAddConnection(ctx: SectionContext): HTMLElement {
  const wrap = el("div", "cc-edit__add");
  const form = el("form", "cc-edit__add-form cc-edit__add-form--stack");

  const name = textInput("Connection name (e.g. Work Calendar)");
  name.setAttribute("aria-label", "New connection name");

  const select = document.createElement("select");
  select.className = "cc-edit__input";
  select.setAttribute("aria-label", "Service");
  for (const [value, label] of SERVICE_LABELS) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  const submit = el("button", "cc-edit__add-btn", "Add connection");
  submit.setAttribute("type", "submit");

  form.appendChild(name);
  form.appendChild(select);
  form.appendChild(submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = name.value.trim();
    if (value.length === 0) return;
    const service = serviceFromValue(select.value);
    ctx.update((config) => {
      config.connections.push({ id: newId("conn"), name: value, service });
    });
  });

  wrap.appendChild(form);
  return wrap;
}
