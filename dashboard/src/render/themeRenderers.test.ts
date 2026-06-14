import { getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Widget } from "../domain/widgets";
import { defaultRenderContext } from "./context";
import { renderWidget } from "./index";
import type { WidgetRenderer } from "./themeRenderers";

function host(): HTMLElement {
  const node = document.createElement("div");
  document.body.appendChild(node);
  return node;
}

afterEach(() => {
  document.body.replaceChildren();
});

const metric: Widget = { type: "metric", data: { value: "42" } };

describe("render-theme dispatch", () => {
  it("renders a themed widget into an isolated shadow root", () => {
    const renderer: WidgetRenderer = (h) => {
      const node = document.createElement("strong");
      node.textContent = "THEMED";
      h.appendChild(node);
    };
    const root = host();

    renderWidget(root, metric, defaultRenderContext({ themeRenderers: { metric: renderer } }));

    const wrapper = root.querySelector(".cc-widget--themed");
    expect(wrapper?.shadowRoot).not.toBeNull();
    expect(wrapper?.shadowRoot?.textContent).toContain("THEMED");
    // Shadow content is isolated: it is not part of the light-DOM text.
    expect(root.textContent).not.toContain("THEMED");
  });

  it("falls back to the platform renderer when the theme has no renderer for a type", () => {
    const root = host();

    renderWidget(root, metric, defaultRenderContext({ themeRenderers: { list: () => undefined } }));

    expect(root.querySelector(".cc-widget--themed")).toBeNull();
    expect(getByText(root, "42")).toBeInTheDocument();
  });

  it("gives a theme renderer the validated context, not a way to open arbitrary urls", () => {
    const invokeAction = vi.fn();
    const renderer: WidgetRenderer = (_host, _widget, ctx) => {
      ctx.invokeAction({ ref: "open", params: { url: "https://x" } });
    };
    renderWidget(host(), metric, defaultRenderContext({ invokeAction, themeRenderers: { metric: renderer } }));

    // The theme could only ask the platform to invoke an action; it never built
    // or opened a URL itself.
    expect(invokeAction).toHaveBeenCalledWith({ ref: "open", params: { url: "https://x" } });
  });
});
