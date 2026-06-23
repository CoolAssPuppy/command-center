import type { Stream, StreamContent } from "../config/schema";
import { el } from "../render/helpers";
import { newId } from "../util/id";
import { field, iconButton, moveInArray, textInput } from "./controls";
import type { SectionContext } from "./editPane";

/**
 * The Work streams section: add a stream (notes or a links group), rename it,
 * reorder, toggle whether it is collapsed by default, remove it, and edit its
 * content. Text and link-selection edits commit on change (blur), so the pane's
 * live re-render never interrupts typing.
 */
export function renderStreamsSection(host: HTMLElement, ctx: SectionContext): void {
  const section = el("section", "cc-edit__section");
  section.appendChild(el("h3", "cc-edit__section-title", "Work streams"));

  const list = el("div", "cc-edit__list");
  ctx.draft.streams.forEach((stream, index) => {
    list.appendChild(renderStreamRow(stream, index, ctx));
  });
  if (ctx.draft.streams.length === 0) {
    list.appendChild(el("div", "cc-edit__hint", "No streams yet. Add one below."));
  }
  section.appendChild(list);

  section.appendChild(renderAddStream(ctx));
  host.appendChild(section);
}

function renderStreamRow(
  stream: Stream,
  index: number,
  ctx: SectionContext,
): HTMLElement {
  const row = el("div", "cc-edit__row cc-edit__row--stack");

  const head = el("div", "cc-edit__row-head");
  const title = textInput("Stream title");
  title.value = stream.title;
  title.setAttribute("aria-label", "Stream title");
  title.addEventListener("change", () => {
    ctx.update((config) => {
      const found = config.streams.find((s) => s.id === stream.id);
      if (found !== undefined && title.value.trim().length > 0) {
        found.title = title.value.trim();
      }
    });
  });
  head.appendChild(title);

  const controls = el("div", "cc-edit__row-controls");
  const collapsedChip = el(
    "button",
    `cc-edit__chip${stream.collapsedByDefault ? " is-active" : ""}`,
    stream.collapsedByDefault ? "Collapsed" : "Open",
  );
  collapsedChip.setAttribute("type", "button");
  collapsedChip.setAttribute("title", "Collapsed by default");
  collapsedChip.addEventListener("click", () => {
    ctx.update((config) => {
      const found = config.streams.find((s) => s.id === stream.id);
      if (found !== undefined) found.collapsedByDefault = !found.collapsedByDefault;
    });
  });
  controls.appendChild(collapsedChip);
  controls.appendChild(
    iconButton("Move up", "↑", () => {
      ctx.update((config) => {
        moveInArray(config.streams, index, -1);
      });
    }),
  );
  controls.appendChild(
    iconButton("Move down", "↓", () => {
      ctx.update((config) => {
        moveInArray(config.streams, index, 1);
      });
    }),
  );
  controls.appendChild(
    iconButton("Remove", "✕", () => {
      ctx.update((config) => {
        config.streams = config.streams.filter((s) => s.id !== stream.id);
      });
    }),
  );
  head.appendChild(controls);
  row.appendChild(head);

  row.appendChild(renderContentEditor(stream, ctx));
  return row;
}

function renderContentEditor(stream: Stream, ctx: SectionContext): HTMLElement {
  const content = stream.content;

  if (content.type === "static") {
    const textarea = document.createElement("textarea");
    textarea.className = "cc-edit__textarea";
    textarea.rows = 3;
    textarea.value = content.body;
    textarea.placeholder = "Write something…";
    textarea.setAttribute("aria-label", "Stream text");
    textarea.addEventListener("change", () => {
      ctx.update((config) => {
        const found = config.streams.find((s) => s.id === stream.id);
        if (found !== undefined && found.content.type === "static") {
          found.content.body = textarea.value;
        }
      });
    });
    return textarea;
  }

  if (content.type === "links") {
    const wrap = el("div", "cc-edit__checks");
    if (ctx.draft.links.length === 0) {
      wrap.appendChild(el("div", "cc-edit__hint", "Add dock links first."));
      return wrap;
    }
    for (const link of ctx.draft.links) {
      const label = el("label", "cc-edit__check");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = content.linkIds.includes(link.id);
      checkbox.addEventListener("change", () => {
        ctx.update((config) => {
          const found = config.streams.find((s) => s.id === stream.id);
          if (found === undefined || found.content.type !== "links") return;
          if (checkbox.checked) {
            if (!found.content.linkIds.includes(link.id)) {
              found.content.linkIds.push(link.id);
            }
          } else {
            found.content.linkIds = found.content.linkIds.filter(
              (id) => id !== link.id,
            );
          }
        });
      });
      label.appendChild(checkbox);
      label.appendChild(el("span", undefined, link.title));
      wrap.appendChild(label);
    }
    return wrap;
  }

  if (content.integrationId === "notion") return renderNotionEditor(stream, ctx);
  return el(
    "div",
    "cc-edit__hint",
    "Connect this service under Connections; it uses sensible defaults.",
  );
}

function updateNotionConfig(
  ctx: SectionContext,
  streamId: string,
  mutate: (config: Record<string, unknown>) => void,
): void {
  ctx.update((config) => {
    const found = config.streams.find((stream) => stream.id === streamId);
    if (found !== undefined && found.content.type === "integration") {
      mutate(found.content.config);
    }
  });
}

function renderNotionEditor(stream: Stream, ctx: SectionContext): HTMLElement {
  const wrap = el("div", "cc-edit__nested");
  const raw: Record<string, unknown> =
    stream.content.type === "integration" ? stream.content.config : {};

  const databaseId = textInput("Database ID");
  databaseId.value = typeof raw.databaseId === "string" ? raw.databaseId : "";
  databaseId.setAttribute("aria-label", "Notion database ID");
  databaseId.addEventListener("change", () => {
    updateNotionConfig(ctx, stream.id, (config) => {
      config.databaseId = databaseId.value.trim();
    });
  });
  wrap.appendChild(field("Database ID", databaseId));

  const titleProperty = textInput("Title property (optional)");
  titleProperty.value = typeof raw.titleProperty === "string" ? raw.titleProperty : "";
  titleProperty.setAttribute("aria-label", "Notion title property");
  titleProperty.addEventListener("change", () => {
    updateNotionConfig(ctx, stream.id, (config) => {
      const value = titleProperty.value.trim();
      if (value.length > 0) config.titleProperty = value;
      else delete config.titleProperty;
    });
  });
  wrap.appendChild(field("Title property", titleProperty));

  const pageSize = textInput("10", "number");
  pageSize.value = String(typeof raw.pageSize === "number" ? raw.pageSize : 10);
  pageSize.setAttribute("aria-label", "Number of items");
  pageSize.addEventListener("change", () => {
    updateNotionConfig(ctx, stream.id, (config) => {
      const parsed = Number(pageSize.value);
      if (Number.isFinite(parsed) && parsed > 0) {
        config.pageSize = Math.min(50, Math.floor(parsed));
      }
    });
  });
  wrap.appendChild(field("Items", pageSize));

  const filter = document.createElement("textarea");
  filter.className = "cc-edit__textarea";
  filter.rows = 3;
  filter.placeholder = '{ "property": "Status", "select": { "equals": "Active" } }';
  filter.value = raw.filter !== undefined ? JSON.stringify(raw.filter, null, 2) : "";
  filter.setAttribute("aria-label", "Notion filter JSON");
  const filterHint = el("div", "cc-edit__hint");
  filter.addEventListener("change", () => {
    const text = filter.value.trim();
    filterHint.replaceChildren();
    if (text.length === 0) {
      updateNotionConfig(ctx, stream.id, (config) => {
        delete config.filter;
      });
      return;
    }
    try {
      const parsed: unknown = JSON.parse(text);
      updateNotionConfig(ctx, stream.id, (config) => {
        config.filter = parsed;
      });
    } catch {
      filterHint.appendChild(el("span", undefined, "Filter must be valid JSON."));
    }
  });
  const filterField = field("Filter (JSON)", filter);
  filterField.appendChild(filterHint);
  wrap.appendChild(filterField);

  return wrap;
}

function contentForType(type: string): StreamContent {
  if (type === "links") return { type: "links", linkIds: [] };
  if (type === "notion") {
    return {
      type: "integration",
      integrationId: "notion",
      config: { databaseId: "", pageSize: 10 },
    };
  }
  if (type === "google-calendar" || type === "linear") {
    return { type: "integration", integrationId: type, config: {} };
  }
  return { type: "static", body: "" };
}

function renderAddStream(ctx: SectionContext): HTMLElement {
  const wrap = el("div", "cc-edit__add");
  const form = el("form", "cc-edit__add-form cc-edit__add-form--stack");

  const title = textInput("Stream title");
  title.setAttribute("aria-label", "New stream title");

  const select = document.createElement("select");
  select.className = "cc-edit__input";
  select.setAttribute("aria-label", "Stream type");
  const streamTypes: ReadonlyArray<readonly [string, string]> = [
    ["static", "Notes"],
    ["links", "Links group"],
    ["google-calendar", "Google Calendar"],
    ["linear", "Linear inbox"],
    ["notion", "Notion database"],
  ];
  for (const [value, text] of streamTypes) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = text;
    select.appendChild(option);
  }

  const submit = el("button", "cc-edit__add-btn", "Add stream");
  submit.setAttribute("type", "submit");

  form.appendChild(title);
  form.appendChild(select);
  form.appendChild(submit);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const titleValue = title.value.trim();
    if (titleValue.length === 0) return;
    const content = contentForType(select.value);
    ctx.update((config) => {
      config.streams.push({
        id: newId("stream"),
        title: titleValue,
        collapsedByDefault: true,
        content,
      });
    });
  });

  wrap.appendChild(form);
  return wrap;
}
