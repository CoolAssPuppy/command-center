import type { Widget, WidgetType } from "../domain/widgets";
import type { RenderContext } from "./context";

/**
 * A render theme provides custom renderers for some widget types. Each receives
 * a host node, the widget (display data only), and the same validated
 * RenderContext the platform renderers get — so a theme can format times and
 * invoke actions through the platform, but cannot reach feeds or tokens or open
 * an arbitrary URL. Themed widgets render into a shadow root for DOM/style
 * isolation. See docs/14-themes.md.
 *
 * This is the FIRST-PARTY render tier. Running untrusted third-party JavaScript
 * safely requires a stronger execution boundary (a sandboxed iframe/worker with
 * connect-src 'none'); that is gated and out of scope here.
 */
export type WidgetRenderer = (
  host: HTMLElement,
  widget: Widget,
  ctx: RenderContext,
) => void;

export type RenderThemeRenderers = Partial<Record<WidgetType, WidgetRenderer>>;
