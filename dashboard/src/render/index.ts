import type { Widget } from "../domain/widgets";
import { renderChart } from "./chart";
import type { RenderContext } from "./context";
import { renderList } from "./list";
import { renderMetric, renderProgress, renderText } from "./simple";
import { renderTable } from "./table";
import { renderTimeline } from "./timeline";

export * from "./context";
export * from "./helpers";

/**
 * Render a single widget into a host node and return its root element. This is
 * the platform's default renderer; a render theme may later override any widget
 * type. Every type in the vocabulary is handled, so the surface is never blank.
 */
export function renderWidget(
  host: HTMLElement,
  widget: Widget,
  ctx: RenderContext,
): HTMLElement {
  switch (widget.type) {
    case "metric":
      return renderMetric(host, widget);
    case "list":
      return renderList(host, widget, ctx);
    case "table":
      return renderTable(host, widget);
    case "chart":
      return renderChart(host, widget);
    case "timeline":
      return renderTimeline(host, widget, ctx);
    case "progress":
      return renderProgress(host, widget);
    case "text":
      return renderText(host, widget);
  }
}
