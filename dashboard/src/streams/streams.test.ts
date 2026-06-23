import { afterEach, describe, expect, it, vi } from "vitest";

import type { DockLink, Stream } from "../config/schema";
import { host } from "../test/dom";
import { renderStreams } from "./streams";

afterEach(() => {
  document.body.replaceChildren();
});

const links: DockLink[] = [{ id: "gh", title: "GitHub", url: "https://github.com" }];

const staticStream = (id: string, body: string, collapsed = true): Stream => ({
  id,
  title: `Stream ${id}`,
  collapsedByDefault: collapsed,
  content: { type: "static", body },
});

const linksStream = (id: string, linkIds: string[]): Stream => ({
  id,
  title: "Links",
  collapsedByDefault: false,
  content: { type: "links", linkIds },
});

const integrationStream = (id: string): Stream => ({
  id,
  title: "Notion",
  collapsedByDefault: true,
  content: { type: "integration", integrationId: "notion", config: {} },
});

const noop = (): void => {};

describe("renderStreams", () => {
  it("renders a collapsible section per stream, collapsed by default", () => {
    const root = host();
    renderStreams(
      root,
      { streams: [staticStream("a", "hello")], links, expanded: {} },
      { navigate: noop, onToggle: noop },
    );
    const details = root.querySelector<HTMLDetailsElement>(".cc-stream");
    expect(details).not.toBeNull();
    expect(details?.open).toBe(false);
  });

  it("opens a stream when the expanded override says so", () => {
    const root = host();
    renderStreams(
      root,
      { streams: [staticStream("a", "hello")], links, expanded: { a: true } },
      { navigate: noop, onToggle: noop },
    );
    expect(root.querySelector<HTMLDetailsElement>(".cc-stream")?.open).toBe(true);
  });

  it("shows static text", () => {
    const root = host();
    renderStreams(
      root,
      { streams: [staticStream("a", "remember the milk")], links, expanded: {} },
      { navigate: noop, onToggle: noop },
    );
    expect(root.querySelector(".cc-stream__text")?.textContent).toBe(
      "remember the milk",
    );
  });

  it("navigates from a links stream", () => {
    const navigate = vi.fn();
    const root = host();
    renderStreams(
      root,
      { streams: [linksStream("a", ["gh"])], links, expanded: {} },
      { navigate, onToggle: noop },
    );
    root.querySelector<HTMLButtonElement>(".cc-stream__link")?.click();
    expect(navigate).toHaveBeenCalledWith("https://github.com");
  });

  it("shows a placeholder for an integration with no renderer", () => {
    const root = host();
    renderStreams(
      root,
      { streams: [integrationStream("a")], links, expanded: {} },
      { navigate: noop, onToggle: noop },
    );
    expect(root.querySelector(".cc-stream__empty")?.textContent).toContain("Connect");
  });

  it("uses the integration renderer when one is provided", () => {
    const renderIntegration = vi.fn((bodyHost: HTMLElement) => {
      bodyHost.appendChild(document.createElement("p"));
    });
    const root = host();
    renderStreams(
      root,
      { streams: [integrationStream("a")], links, expanded: {} },
      { navigate: noop, onToggle: noop, renderIntegration },
    );
    expect(renderIntegration).toHaveBeenCalledOnce();
  });

  it("reports toggles", () => {
    const onToggle = vi.fn();
    const root = host();
    renderStreams(
      root,
      { streams: [staticStream("a", "x")], links, expanded: {} },
      { navigate: noop, onToggle },
    );
    const details = root.querySelector<HTMLDetailsElement>(".cc-stream");
    if (details === null) throw new Error("no details");
    details.open = true;
    details.dispatchEvent(new Event("toggle"));
    expect(onToggle).toHaveBeenCalledWith("a", true);
  });
});
