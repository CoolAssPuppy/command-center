import { el } from "../render/helpers";

/**
 * Small form controls shared by the edit-pane sections, so reorder buttons,
 * inputs, and array moves are defined once.
 */
export function iconButton(
  label: string,
  glyph: string,
  onClick: () => void,
): HTMLElement {
  const button = el("button", "cc-edit__icon-btn", glyph);
  button.setAttribute("type", "button");
  button.setAttribute("aria-label", label);
  button.setAttribute("title", label);
  button.addEventListener("click", onClick);
  return button;
}

export function textInput(placeholder: string, type = "text"): HTMLInputElement {
  const input = document.createElement("input");
  input.type = type;
  input.className = "cc-edit__input";
  input.placeholder = placeholder;
  return input;
}

/** A labelled field wrapper around a control. */
export function field(labelText: string, control: HTMLElement): HTMLElement {
  const wrap = el("div", "cc-edit__field");
  wrap.appendChild(el("label", "cc-edit__field-label", labelText));
  wrap.appendChild(control);
  return wrap;
}

/**
 * A collapsible edit-pane section built on native <details>, so keyboard and
 * accessibility come for free. The open/closed state lives in the caller's
 * `collapsed` set (keyed by `key`) so it survives the pane's full re-renders.
 * Content is appended to the body passed to `build`.
 */
export function collapsibleSection(
  host: HTMLElement,
  options: { title: string; key: string; collapsed: Set<string> },
  build: (body: HTMLElement) => void,
): void {
  const details = document.createElement("details");
  details.className = "cc-edit__section";
  details.open = !options.collapsed.has(options.key);

  const summary = document.createElement("summary");
  summary.className = "cc-edit__section-summary";
  summary.appendChild(el("span", "cc-edit__section-title", options.title));
  summary.appendChild(el("span", "cc-edit__section-caret", "›"));
  details.appendChild(summary);

  const body = el("div", "cc-edit__section-body");
  build(body);
  details.appendChild(body);

  details.addEventListener("toggle", () => {
    if (details.open) options.collapsed.delete(options.key);
    else options.collapsed.add(options.key);
  });

  host.appendChild(details);
}

/** Swap an item with its neighbour, in place. A no-op at the ends. */
export function moveInArray<T>(items: T[], index: number, delta: number): void {
  const target = index + delta;
  if (target < 0 || target >= items.length) return;
  const moved = items[index];
  const swapped = items[target];
  if (moved === undefined || swapped === undefined) return;
  items[index] = swapped;
  items[target] = moved;
}

/** Move an item from one index to another, in place (for drag reordering). */
export function reorderInArray<T>(items: T[], from: number, to: number): void {
  if (from === to) return;
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return;
  const moved = items.splice(from, 1)[0];
  if (moved === undefined) return;
  items.splice(to, 0, moved);
}
