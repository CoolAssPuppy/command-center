import type { Widget } from "../domain/widgets";
import { applyTone, clamp, el } from "./helpers";

type MetricWidget = Extract<Widget, { type: "metric" }>;
type ProgressWidget = Extract<Widget, { type: "progress" }>;
type TextWidget = Extract<Widget, { type: "text" }>;

export function renderMetric(host: HTMLElement, widget: MetricWidget): HTMLElement {
  const root = el("div", "cc-widget cc-metric");
  applyTone(root, widget.data.tone);
  if (widget.title !== undefined) {
    root.appendChild(el("div", "cc-widget__title", widget.title));
  }
  root.appendChild(el("div", "cc-metric__value", widget.data.value));
  if (widget.data.label !== undefined) {
    root.appendChild(el("div", "cc-metric__label", widget.data.label));
  }
  if (widget.data.trend !== undefined) {
    const trend = el("span", "cc-metric__trend", widget.data.delta ?? "");
    trend.setAttribute("data-trend", widget.data.trend);
    root.appendChild(trend);
  }
  host.appendChild(root);
  return root;
}

export function renderProgress(
  host: HTMLElement,
  widget: ProgressWidget,
): HTMLElement {
  const root = el("div", "cc-widget cc-progress");
  applyTone(root, widget.data.tone);
  const percent = Math.round(clamp(widget.data.value, 0, 1) * 100);

  const track = el("div", "cc-progress__track");
  track.setAttribute("role", "progressbar");
  track.setAttribute("aria-valuemin", "0");
  track.setAttribute("aria-valuemax", "100");
  track.setAttribute("aria-valuenow", String(percent));
  const fill = el("div", "cc-progress__fill");
  fill.style.width = `${String(percent)}%`;
  track.appendChild(fill);
  root.appendChild(track);

  if (widget.data.label !== undefined) {
    root.appendChild(el("div", "cc-progress__label", widget.data.label));
  }
  host.appendChild(root);
  return root;
}

export function renderText(host: HTMLElement, widget: TextWidget): HTMLElement {
  const root = el("div", "cc-widget cc-text", widget.data.body);
  root.setAttribute("data-emphasis", widget.data.emphasis ?? "normal");
  host.appendChild(root);
  return root;
}
