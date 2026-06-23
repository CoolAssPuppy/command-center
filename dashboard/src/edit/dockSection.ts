import type { Config, DockLink } from "../config/schema";
import { el } from "../render/helpers";
import { isSafeUrl } from "../security/url";
import { newId } from "../util/id";
import type { SectionContext } from "./editPane";

/**
 * The Dock links section: reorder, remove, and add links. A new link's url is
 * normalized to https when no scheme is given, then validated before it is
 * accepted, so the stored config always holds a safe, parseable url.
 */
export function renderDockSection(host: HTMLElement, ctx: SectionContext): void {
  const section = el("section", "cc-edit__section");
  section.appendChild(el("h3", "cc-edit__section-title", "Dock links"));

  const list = el("div", "cc-edit__list");
  ctx.draft.links.forEach((link, index) => {
    list.appendChild(renderLinkRow(link, index, ctx));
  });
  if (ctx.draft.links.length === 0) {
    list.appendChild(el("div", "cc-edit__hint", "No links yet. Add one below."));
  }
  section.appendChild(list);

  section.appendChild(renderAddLink(ctx));
  host.appendChild(section);
}

function iconButton(label: string, glyph: string, onClick: () => void): HTMLElement {
  const button = el("button", "cc-edit__icon-btn", glyph);
  button.setAttribute("type", "button");
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.addEventListener("click", onClick);
  return button;
}

function moveLink(config: Config, index: number, delta: number): void {
  const target = index + delta;
  if (target < 0 || target >= config.links.length) return;
  const links = config.links;
  const moved = links[index];
  const swapped = links[target];
  if (moved === undefined || swapped === undefined) return;
  links[index] = swapped;
  links[target] = moved;
}

function renderLinkRow(
  link: DockLink,
  index: number,
  ctx: SectionContext,
): HTMLElement {
  const row = el("div", "cc-edit__row");

  const label = el("div", "cc-edit__row-label");
  label.appendChild(el("span", "cc-edit__row-name", link.title));
  label.appendChild(el("span", "cc-edit__row-sub", link.url));
  row.appendChild(label);

  const controls = el("div", "cc-edit__row-controls");
  controls.appendChild(
    iconButton("Move up", "↑", () => {
      ctx.update((config) => {
        moveLink(config, index, -1);
      });
    }),
  );
  controls.appendChild(
    iconButton("Move down", "↓", () => {
      ctx.update((config) => {
        moveLink(config, index, 1);
      });
    }),
  );
  controls.appendChild(
    iconButton("Remove", "✕", () => {
      ctx.update((config) => {
        config.links = config.links.filter((l) => l.id !== link.id);
      });
    }),
  );
  row.appendChild(controls);
  return row;
}

function textInput(placeholder: string, type: string): HTMLInputElement {
  const input = document.createElement("input");
  input.type = type;
  input.className = "cc-edit__input";
  input.placeholder = placeholder;
  return input;
}

/** Add a scheme when the user typed a bare host, e.g. "github.com". */
function normalizeUrl(raw: string): string {
  return /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
}

function renderAddLink(ctx: SectionContext): HTMLElement {
  const wrap = el("div", "cc-edit__add");
  const form = el("form", "cc-edit__add-form cc-edit__add-form--stack");

  const title = textInput("Title", "text");
  title.setAttribute("aria-label", "Link title");
  const url = textInput("example.com", "text");
  url.setAttribute("aria-label", "Link URL");
  const submit = el("button", "cc-edit__add-btn", "Add link");
  submit.setAttribute("type", "submit");

  form.appendChild(title);
  form.appendChild(url);
  form.appendChild(submit);

  const error = el("div", "cc-edit__hint");

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.replaceChildren();
    const titleValue = title.value.trim();
    const urlValue = normalizeUrl(url.value.trim());
    if (titleValue.length === 0 || url.value.trim().length === 0) return;
    if (!isSafeUrl(urlValue)) {
      error.appendChild(el("span", undefined, "Enter a valid http or https URL."));
      return;
    }
    ctx.update((config) => {
      config.links.push({ id: newId("link"), title: titleValue, url: urlValue });
    });
  });

  wrap.appendChild(form);
  wrap.appendChild(error);
  return wrap;
}
