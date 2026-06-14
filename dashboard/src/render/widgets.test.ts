import { fireEvent, getByRole, getByText, queryByText } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { Widget } from "../domain/widgets";
import { defaultRenderContext } from "./context";
import { renderWidget } from "./index";

function host(): HTMLElement {
  const node = document.createElement("div");
  document.body.appendChild(node);
  return node;
}

afterEach(() => {
  document.body.replaceChildren();
});

const XSS = '<img src=x onerror="alert(1)">';

describe("renderMetric", () => {
  it("renders value, label, tone, and trend", () => {
    const root = host();
    const widget: Widget = {
      type: "metric",
      data: { value: "12", label: "awaiting review", tone: "urgent", trend: "up", delta: "+3" },
    };

    renderWidget(root, widget, defaultRenderContext());

    expect(getByText(root, "12")).toBeInTheDocument();
    expect(getByText(root, "awaiting review")).toBeInTheDocument();
    expect(root.querySelector(".cc-metric")?.getAttribute("data-tone")).toBe("urgent");
    expect(root.querySelector(".cc-metric__trend")?.getAttribute("data-trend")).toBe("up");
  });
});

describe("renderList", () => {
  it("renders titles and subtitles as inert text", () => {
    const root = host();
    const widget: Widget = {
      type: "list",
      data: { items: [{ title: XSS, subtitle: "2m ago" }] },
    };

    renderWidget(root, widget, defaultRenderContext());

    expect(getByText(root, XSS)).toBeInTheDocument();
    expect(root.querySelector("img")).toBeNull();
  });

  it("formats a time trailing through the context", () => {
    const root = host();
    const widget: Widget = {
      type: "list",
      data: {
        items: [{ title: "Standup", trailing: { kind: "time", iso: "2026-06-14T16:00:00Z" } }],
      },
    };

    renderWidget(root, widget, defaultRenderContext({ formatTime: () => "FMT" }));

    expect(getByText(root, "FMT")).toBeInTheDocument();
  });

  it("invokes the action ref on click without resolving the url itself", () => {
    const root = host();
    const invokeAction = vi.fn();
    const action = { ref: "open", params: { url: "https://linear.app/x" } };
    const widget: Widget = {
      type: "list",
      data: { items: [{ title: "Open issue", action }] },
    };

    renderWidget(root, widget, defaultRenderContext({ invokeAction }));
    fireEvent.click(getByRole(root, "button", { name: /Open issue/ }));

    expect(invokeAction).toHaveBeenCalledWith(action);
  });

  it("renders an avatar leading as an image", () => {
    const root = host();
    const widget: Widget = {
      type: "list",
      data: {
        items: [{ title: "x", leading: { kind: "avatar", url: "https://e.com/a.png" } }],
      },
    };

    renderWidget(root, widget, defaultRenderContext());

    expect(root.querySelector("img.cc-avatar")?.getAttribute("src")).toBe(
      "https://e.com/a.png",
    );
  });
});

describe("renderTable", () => {
  it("renders headers and typed cells", () => {
    const root = host();
    const widget: Widget = {
      type: "table",
      data: {
        columns: [
          { key: "name", label: "Service", type: "text" },
          { key: "p95", label: "p95", type: "number", unit: "ms" },
          { key: "status", label: "", type: "badge" },
        ],
        rows: [{ name: "api", p95: 142, status: { text: "ok", tone: "positive" } }],
      },
    };

    renderWidget(root, widget, defaultRenderContext());

    expect(getByText(root, "Service")).toBeInTheDocument();
    expect(getByText(root, "142 ms")).toBeInTheDocument();
    const badge = root.querySelector(".cc-badge");
    expect(badge?.textContent).toBe("ok");
    expect(badge?.getAttribute("data-tone")).toBe("positive");
  });
});

describe("renderChart", () => {
  it("plots one point per data point for a line chart", () => {
    const root = host();
    const widget: Widget = {
      type: "chart",
      data: {
        subtype: "line",
        xType: "time",
        series: [{ name: "s", points: [{ x: 0, y: 1 }, { x: 1, y: 4 }, { x: 2, y: 2 }] }],
      },
    };

    renderWidget(root, widget, defaultRenderContext());

    expect(root.querySelectorAll("circle.cc-chart__point")).toHaveLength(3);
    expect(root.querySelector("svg")?.getAttribute("data-subtype")).toBe("line");
  });

  it("draws a radial shape for a donut", () => {
    const root = host();
    const widget: Widget = {
      type: "chart",
      data: { subtype: "donut", xType: "category", series: [{ name: "s", points: [{ x: "a", y: 1 }] }] },
    };

    renderWidget(root, widget, defaultRenderContext());

    expect(root.querySelector("circle.cc-chart__radial")).not.toBeNull();
    expect(root.querySelector("[data-subtype='donut']")).not.toBeNull();
  });
});

describe("renderTimeline", () => {
  it("positions an item within the axis and wires its action", () => {
    const root = host();
    const invokeAction = vi.fn();
    const action = { ref: "join", params: { url: "https://meet.google.com/x" } };
    const widget: Widget = {
      type: "timeline",
      data: {
        from: "2026-06-14T08:00:00Z",
        to: "2026-06-14T18:00:00Z",
        items: [
          {
            start: "2026-06-14T13:00:00Z",
            end: "2026-06-14T14:00:00Z",
            label: "Review",
            action,
          },
        ],
      },
    };

    renderWidget(root, widget, defaultRenderContext({ invokeAction }));
    const item = getByRole(root, "button", { name: /Review/ });

    expect(item.style.left).toBe("50%"); // 13:00 is halfway through 08:00-18:00
    fireEvent.click(item);
    expect(invokeAction).toHaveBeenCalledWith(action);
  });
});

describe("renderProgress", () => {
  it("reflects the value as an accessible progressbar", () => {
    const root = host();
    const widget: Widget = {
      type: "progress",
      data: { value: 0.6, label: "Sprint 14" },
    };

    renderWidget(root, widget, defaultRenderContext());

    const bar = getByRole(root, "progressbar");
    expect(bar.getAttribute("aria-valuenow")).toBe("60");
    expect(getByText(root, "Sprint 14")).toBeInTheDocument();
  });
});

describe("renderText", () => {
  it("renders the body as text with an emphasis attribute", () => {
    const root = host();
    const widget: Widget = {
      type: "text",
      data: { body: "All systems normal.", emphasis: "muted" },
    };

    renderWidget(root, widget, defaultRenderContext());

    expect(getByText(root, "All systems normal.")).toBeInTheDocument();
    expect(root.querySelector(".cc-text")?.getAttribute("data-emphasis")).toBe("muted");
    expect(queryByText(root, "<b>")).toBeNull();
  });
});
