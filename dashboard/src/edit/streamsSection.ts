import type { Connection } from "../config/schema";
import { el } from "../render/helpers";
import { newId } from "../util/id";
import { collapsibleSection, iconButton, reorderInArray, textInput } from "./controls";
import type { SectionContext } from "./editPane";
import { makeReorderable } from "./reorderable";

/**
 * The Work streams section: each work stream is a panel with a title that shows
 * one of your connections. You add, rename, reorder, repoint, and remove them.
 * It needs at least one connection first.
 */
function connectionSelect(
  connections: Connection[],
  selectedId: string | undefined,
): HTMLSelectElement {
  const select = document.createElement("select");
  select.className = "cc-edit__input";
  select.setAttribute("aria-label", "Connection");
  for (const connection of connections) {
    const option = document.createElement("option");
    option.value = connection.id;
    option.textContent = connection.name;
    if (connection.id === selectedId) option.selected = true;
    select.appendChild(option);
  }
  return select;
}

export function renderStreamsSection(host: HTMLElement, ctx: SectionContext): void {
  collapsibleSection(
    host,
    { title: "Work streams", key: "streams", collapsed: ctx.collapsed },
    (section) => {
      if (ctx.draft.connections.length === 0) {
        section.appendChild(
          el(
            "div",
            "cc-edit__hint",
            "Add a Connection first, then create a Work stream that shows it.",
          ),
        );
        return;
      }

      const list = el("div", "cc-edit__list");
      ctx.draft.streams.forEach((stream, index) => {
        list.appendChild(renderStreamRow(stream, index, ctx));
      });
      if (ctx.draft.streams.length === 0) {
        list.appendChild(el("div", "cc-edit__hint", "No work streams yet. Add one below."));
      }
      section.appendChild(list);
      section.appendChild(renderAddStream(ctx));
    },
  );
}

function renderStreamRow(
  stream: { id: string; title: string; connectionId: string },
  index: number,
  ctx: SectionContext,
): HTMLElement {
  const row = el("div", "cc-edit__row");

  const fields = el("div", "cc-edit__row-fields");
  const title = textInput("Stream title");
  title.value = stream.title;
  title.setAttribute("aria-label", "Stream title");
  title.addEventListener("change", () => {
    ctx.update((config) => {
      const found = config.streams.find((item) => item.id === stream.id);
      if (found !== undefined && title.value.trim().length > 0) found.title = title.value.trim();
    });
  });
  const select = connectionSelect(ctx.draft.connections, stream.connectionId);
  select.addEventListener("change", () => {
    ctx.update((config) => {
      const found = config.streams.find((item) => item.id === stream.id);
      if (found !== undefined) found.connectionId = select.value;
    });
  });
  fields.appendChild(title);
  fields.appendChild(select);
  row.appendChild(fields);

  const controls = el("div", "cc-edit__row-controls");
  controls.appendChild(
    iconButton("Remove", "✕", () => {
      ctx.update((config) => {
        config.streams = config.streams.filter((item) => item.id !== stream.id);
      });
    }),
  );
  row.appendChild(controls);

  makeReorderable({
    row,
    index,
    count: ctx.draft.streams.length,
    itemId: stream.id,
    itemNoun: "work stream",
    applyReorder: (from, to) =>
      ctx.update((config) => {
        reorderInArray(config.streams, from, to);
      }),
  });
  return row;
}

function renderAddStream(ctx: SectionContext): HTMLElement {
  const wrap = el("div", "cc-edit__add");
  const form = el("form", "cc-edit__add-form");

  const title = textInput("Stream title");
  title.setAttribute("aria-label", "New stream title");
  const select = connectionSelect(ctx.draft.connections, ctx.draft.connections[0]?.id);

  const submit = el("button", "cc-edit__add-btn", "Add stream");
  submit.setAttribute("type", "submit");

  form.appendChild(title);
  form.appendChild(select);
  form.appendChild(submit);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = title.value.trim();
    const connectionId = select.value;
    if (value.length === 0 || connectionId.length === 0) return;
    ctx.update((config) => {
      config.streams.push({
        id: newId("stream"),
        title: value,
        connectionId,
        collapsedByDefault: false,
      });
    });
  });

  wrap.appendChild(form);
  return wrap;
}
