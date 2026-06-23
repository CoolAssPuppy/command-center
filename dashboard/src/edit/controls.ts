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
