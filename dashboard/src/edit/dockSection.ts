import type { DockLink } from "../config/schema";
import { el, svgEl } from "../render/helpers";
import { isSafeUrl } from "../security/url";
import { newId } from "../util/id";
import {
  collapsibleSection,
  iconButton,
  moveInArray,
  reorderInArray,
  textInput,
} from "./controls";
import type { SectionContext } from "./editPane";

/**
 * The Dock links section: reorder by dragging the grab handle, edit a link's
 * title or url in place, remove, and add. A url is normalized to https when no
 * scheme is given, then validated before it is accepted, so the stored config
 * always holds a safe, parseable url.
 */
export function renderDockSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    { title: "Dock links", key: "dock", collapsed: ctx.collapsed },
    (section) => {
      const list = el("div", "cc-edit__list");
      ctx.draft.links.forEach((link, index) => {
        list.appendChild(renderLinkRow(link, index, ctx));
      });
      if (ctx.draft.links.length === 0) {
        list.appendChild(el("div", "cc-edit__hint", "No links yet. Add one below."));
      }
      section.appendChild(list);
      section.appendChild(renderAddLink(ctx));
    },
  );
}

/** A six-dot grip mark, the drag affordance shown on row hover. */
function gripHandle(): HTMLElement {
  const handle = el("span", "cc-edit__grip");
  handle.setAttribute("aria-hidden", "true");
  const mark = svgEl("svg", { viewBox: "0 0 10 16", width: "10", height: "16", fill: "currentColor" });
  for (const [cx, cy] of [
    [2, 3], [8, 3], [2, 8], [8, 8], [2, 13], [8, 13],
  ] as const) {
    mark.appendChild(svgEl("circle", { cx: String(cx), cy: String(cy), r: "1.3" }));
  }
  handle.appendChild(mark);
  return handle;
}

/** Mutate one link by id, persisting and re-rendering. */
function updateLink(
  ctx: SectionContext,
  id: string,
  mutate: (link: DockLink) => void,
): void {
  ctx.update((config) => {
    const link = config.links.find((l) => l.id === id);
    if (link !== undefined) mutate(link);
  });
}

function renderLinkRow(
  link: DockLink,
  index: number,
  ctx: SectionContext,
): HTMLElement {
  const row = el("div", "cc-edit__row cc-edit__row--drag");

  const handle = gripHandle();
  handle.title = "Drag to reorder";
  // Only arm dragging from the handle, so the inputs stay selectable.
  handle.addEventListener("mousedown", () => {
    row.draggable = true;
  });
  row.appendChild(handle);

  const fields = el("div", "cc-edit__row-fields");
  const title = textInput("Title");
  title.value = link.title;
  title.setAttribute("aria-label", "Link title");
  title.addEventListener("change", () => {
    const value = title.value.trim();
    if (value.length > 0) updateLink(ctx, link.id, (l) => (l.title = value));
  });
  const url = textInput("example.com");
  url.value = link.url;
  url.setAttribute("aria-label", "Link URL");
  url.addEventListener("change", () => {
    const value = normalizeUrl(url.value.trim());
    if (isSafeUrl(value)) updateLink(ctx, link.id, (l) => (l.url = value));
  });
  fields.appendChild(title);
  fields.appendChild(url);
  row.appendChild(fields);

  // Buttons are the accessible reorder path; dragging the grip is an
  // enhancement. Keyboard and touch users cannot drag, so they get these.
  const controls = el("div", "cc-edit__row-controls");
  controls.appendChild(
    iconButton("Move up", "↑", () => {
      ctx.update((config) => {
        moveInArray(config.links, index, -1);
      });
    }),
  );
  controls.appendChild(
    iconButton("Move down", "↓", () => {
      ctx.update((config) => {
        moveInArray(config.links, index, 1);
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

  wireDragReorder(row, index, ctx);
  return row;
}

/** HTML5 drag-and-drop reordering, keyed by the row's current index. */
function wireDragReorder(
  row: HTMLElement,
  index: number,
  ctx: SectionContext,
): void {
  row.addEventListener("dragstart", (event) => {
    event.dataTransfer?.setData("text/plain", String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
    row.classList.add("is-dragging");
  });
  row.addEventListener("dragend", () => {
    row.classList.remove("is-dragging");
    row.draggable = false;
  });
  row.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
    row.classList.add("is-drop-target");
  });
  row.addEventListener("dragleave", () => {
    row.classList.remove("is-drop-target");
  });
  row.addEventListener("drop", (event) => {
    event.preventDefault();
    row.classList.remove("is-drop-target");
    const from = Number(event.dataTransfer?.getData("text/plain"));
    if (Number.isInteger(from) && from !== index) {
      ctx.update((config) => {
        reorderInArray(config.links, from, index);
      });
    }
  });
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
