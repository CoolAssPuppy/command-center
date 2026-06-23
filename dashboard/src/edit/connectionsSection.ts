import type { Secrets } from "../config/schema";
import { el } from "../render/helpers";
import { field } from "./controls";
import type { SectionContext } from "./editPane";

/**
 * The Connections section holds integration credentials. Google Calendar uses
 * OAuth (chrome.identity), so it shows a Connect button rather than a key field;
 * Linear and Notion use personal tokens. Tokens are secrets and go through
 * updateSecrets (local, never synced). Per-stream config (which calendar, which
 * database, which filter) lives on the stream in the Work streams section.
 */
function secretInput(
  placeholder: string,
  value: string | undefined,
  commit: (value: string) => void,
): HTMLInputElement {
  const input = document.createElement("input");
  input.type = "password";
  input.className = "cc-edit__input";
  input.placeholder = placeholder;
  input.value = value ?? "";
  input.setAttribute("aria-label", placeholder);
  input.addEventListener("change", () => {
    commit(input.value.trim());
  });
  return input;
}

export function renderConnectionsSection(host: HTMLElement, ctx: SectionContext): void {
  const section = el("section", "cc-edit__section");
  section.appendChild(el("h3", "cc-edit__section-title", "Connections"));

  const connect = ctx.runtime.connectGoogle;
  if (connect !== undefined) {
    const wrap = el("div", "cc-edit__add-form cc-edit__add-form--stack");
    const button = el("button", "cc-edit__add-btn", "Connect Google Calendar");
    button.setAttribute("type", "button");
    button.addEventListener("click", () => {
      void connect();
    });
    wrap.appendChild(button);
    section.appendChild(field("Google Calendar", wrap));
  }

  const setSecret = (
    key: keyof Secrets,
    value: string,
  ): void => {
    ctx.updateSecrets((secrets) => {
      if (value.length > 0) secrets[key] = value;
      else delete secrets[key];
    });
  };

  section.appendChild(
    field(
      "Linear",
      secretInput("Linear API key", ctx.draftSecrets.linearApiKey, (value) => {
        setSecret("linearApiKey", value);
      }),
    ),
  );
  section.appendChild(
    field(
      "Notion",
      secretInput("Notion integration token", ctx.draftSecrets.notionToken, (value) => {
        setSecret("notionToken", value);
      }),
    ),
  );
  section.appendChild(
    el(
      "div",
      "cc-edit__hint",
      "Linear: a personal API key (Settings, API). Notion: an internal integration token, with your database shared to it. Stored locally, never synced.",
    ),
  );

  host.appendChild(section);
}
