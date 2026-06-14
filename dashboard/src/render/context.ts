import type { ActionRef } from "../domain/actions";
import type { RenderThemeRenderers } from "./themeRenderers";

/**
 * What a renderer needs from the platform: how to format a time, how to invoke
 * an action, and whether motion is reduced. A renderer never resolves or opens
 * a URL itself; it calls invokeAction with the widget's action reference and the
 * platform validates and navigates. See docs/10-security.md.
 */
export interface RenderContext {
  formatTime: (iso: string) => string;
  invokeAction: (ref: ActionRef) => void;
  reducedMotion: boolean;
  /** Per-widget-type overrides from the active render theme, if any. */
  themeRenderers?: RenderThemeRenderers;
}

function defaultFormatTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function defaultRenderContext(
  overrides: Partial<RenderContext> = {},
): RenderContext {
  return {
    formatTime: defaultFormatTime,
    invokeAction: () => {
      /* no-op until the bridge wires it */
    },
    reducedMotion: false,
    ...overrides,
  };
}
