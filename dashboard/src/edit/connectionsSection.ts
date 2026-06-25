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
 * The Connections section: identity only. A connection is a label, a service, and
 * its credential (a token in connectionSecrets, or a Google account token). All
 * per-card customization lives on the Data Cards, not here.
 */
const SERVICE_LABELS: ReadonlyArray<readonly [Service, string]> = [
  ["github", "GitHub"],
  ["google-calendar", "Google Calendar"],
  ["google-tasks", "Google Tasks"],
  ["linear", "Linear"],
  ["notion", "Notion"],
  ["todoist", "Todoist"],
];

const SECRET_PLACEHOLDERS: Partial<Record<Service, string>> = {
  linear: "Linear API key",
  github: "GitHub token",
  notion: "Notion token",
  todoist: "Todoist API token",
};

function usesGoogleAccount(service: Service): boolean {
  return service === "google-calendar" || service === "google-tasks";
}

function serviceFromValue(value: string): Service {
  return SERVICE_LABELS.find(([id]) => id === value)?.[0] ?? "notion";
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
    ctx.update((config) => {
      const found = config.connections.find((item) => item.id === connection.id);
      if (found !== undefined && name.value.trim().length > 0) found.name = name.value.trim();
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

  row.appendChild(renderCredential(connection, ctx));

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

/** The connection's credential: a Google account button or a token field. */
function renderCredential(connection: Connection, ctx: SectionContext): HTMLElement {
  const wrap = el("div", "cc-edit__nested");

  if (usesGoogleAccount(connection.service)) {
    const connect = ctx.runtime.connectGoogleAccount;
    const connected = ctx.draftSecrets.googleTokens[connection.id];
    if (connected !== undefined) {
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
    return wrap;
  }

  const key = document.createElement("input");
  key.type = "password";
  key.className = "cc-edit__input";
  const keyLabel = SECRET_PLACEHOLDERS[connection.service] ?? "Token";
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
  return wrap;
}

/** A password field for a credential. */
function secretField(placeholder: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "password";
  input.className = "cc-edit__input";
  input.placeholder = placeholder;
  input.setAttribute("aria-label", placeholder);
  return input;
}

/**
 * Add a connection: a name, the service, and (for token services) the credential.
 * Google services connect their account afterwards on the connection's row. All
 * per-source setup happens later on a Data Card.
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

  // Rebuilt whenever the service changes; holds the credential field (if any).
  const fieldsBox = el("div", "cc-edit__add-fields");
  let secretInput: HTMLInputElement | undefined;

  const rebuildFields = (): void => {
    fieldsBox.replaceChildren();
    secretInput = undefined;
    const service = serviceFromValue(select.value);

    if (usesGoogleAccount(service)) {
      fieldsBox.appendChild(
        el(
          "div",
          "cc-edit__hint",
          "No credential here. Add it, then connect your Google account on its row.",
        ),
      );
      return;
    }
    const placeholder = SECRET_PLACEHOLDERS[service] ?? "Token";
    const token = secretField(placeholder);
    secretInput = token;
    fieldsBox.appendChild(field(service === "linear" ? "API key" : "Token", token));
    fieldsBox.appendChild(
      el("div", "cc-edit__hint", "Stored locally, never synced."),
    );
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
    const secret = secretInput?.value.trim();

    ctx.update((config) => {
      config.connections.push({ id, name: nameValue, service });
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
