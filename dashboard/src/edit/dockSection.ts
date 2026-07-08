import type { DockLink } from "../config/schema";
import { el } from "../render/helpers";
import { isSafeUrl } from "../security/url";
import { newId } from "../util/id";
import { checkRow, collapsibleSection, iconButton, reorderInArray, textInput } from "./controls";
import type { SectionContext } from "./editPane";
import { makeReorderable } from "./reorderable";

/**
 * The Dock links section: reorder by dragging the grab handle, edit a link's
 * title or url in place, remove, and add. A url is normalized to https when no
 * scheme is given, then validated before it is accepted, so the stored config
 * always holds a safe, parseable url.
 */
export function renderDockSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    {
      title: "Dock",
      key: "dock",
      collapsed: ctx.collapsed,
      description: "App shortcuts along the bottom, plus dock options.",
    },
    (section) => {
      section.appendChild(
        checkRow("Enable dock", ctx.draft.appearance.showDock !== false, (checked) => {
          ctx.update((config) => {
            config.appearance.showDock = checked;
          });
        }),
      );
      section.appendChild(
        checkRow(
          "Enable dock magnification",
          ctx.draft.appearance.dockMagnification !== false,
          (checked) => {
            ctx.update((config) => {
              config.appearance.dockMagnification = checked;
            });
          },
          // Magnification only matters when the dock is shown, so disable it
          // (and gray it out) while the dock is off.
          ctx.draft.appearance.showDock === false,
        ),
      );

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
  const row = el("div", "cc-edit__row");

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

  const controls = el("div", "cc-edit__row-controls");
  controls.appendChild(
    iconButton("Remove", "✕", () => {
      ctx.update((config) => {
        config.links = config.links.filter((l) => l.id !== link.id);
      });
    }),
  );
  row.appendChild(controls);

  makeReorderable({
    row,
    index,
    count: ctx.draft.links.length,
    itemId: link.id,
    itemNoun: "link",
    applyReorder: (from, to) =>
      ctx.update((config) => {
        reorderInArray(config.links, from, to);
      }),
  });
  return row;
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
