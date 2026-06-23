import { el } from "../render/helpers";
import { field } from "./controls";
import type { SectionContext } from "./editPane";

/**
 * The Connections section holds integration credentials. These are secrets, so
 * they go through updateSecrets (local, never synced). Per-stream integration
 * config (which database, which filter) lives on the stream itself in the Work
 * streams section; only the shared token lives here.
 */
export function renderConnectionsSection(host: HTMLElement, ctx: SectionContext): void {
  const section = el("section", "cc-edit__section");
  section.appendChild(el("h3", "cc-edit__section-title", "Connections"));

  const token = document.createElement("input");
  token.type = "password";
  token.className = "cc-edit__input";
  token.placeholder = "Notion integration token";
  token.value = ctx.draftSecrets.notionToken ?? "";
  token.setAttribute("aria-label", "Notion integration token");
  token.addEventListener("change", () => {
    ctx.updateSecrets((secrets) => {
      const value = token.value.trim();
      if (value.length > 0) secrets.notionToken = value;
      else delete secrets.notionToken;
    });
  });
  section.appendChild(field("Notion token", token));
  section.appendChild(
    el(
      "div",
      "cc-edit__hint",
      "Create an internal integration in Notion's settings, share your database with it, and paste the token. Stored locally, never synced.",
    ),
  );

  host.appendChild(section);
}
