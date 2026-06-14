import type { Widget } from "../domain/widgets";
import { renderChart } from "./chart";
import type { RenderContext } from "./context";
import { el } from "./helpers";
import { renderList } from "./list";
import { renderMetric, renderProgress, renderText } from "./simple";
import { renderTable } from "./table";
import { renderTimeline } from "./timeline";
import type { WidgetRenderer } from "./themeRenderers";

export * from "./context";
export * from "./helpers";
export * from "./themeRenderers";

/**
 * Render a single widget into a host node and return its root element. If the
 * active theme provides a renderer for this widget type, it is used inside an
 * isolated shadow root; otherwise the platform default. Every type is handled,
 * so the surface is never blank.
 */
export function renderWidget(
  host: HTMLElement,
  widget: Widget,
  ctx: RenderContext,
): HTMLElement {
  const themed = ctx.themeRenderers?.[widget.type];
  if (themed) return renderThemed(host, widget, ctx, themed);

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

/**
 * Render a widget via a theme renderer inside a shadow root. The shadow boundary
 * isolates the theme's DOM and styles from the rest of the page (CSS custom
 * properties still pierce it, so theme styles can use the --cc-* tokens). The
 * theme paints into a normal element inside the shadow, receiving only display
 * data and the validated context.
 */
function renderThemed(
  host: HTMLElement,
  widget: Widget,
  ctx: RenderContext,
  renderer: WidgetRenderer,
): HTMLElement {
  const wrapper = el("div", "cc-widget cc-widget--themed");
  const shadow = wrapper.attachShadow({ mode: "open" });
  const inner = document.createElement("div");
  shadow.appendChild(inner);
  renderer(inner, widget, ctx);
  host.appendChild(wrapper);
  return wrapper;
}
