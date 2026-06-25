import { afterEach, describe, expect, it, vi } from "vitest";

import type { Connection, Service, Stream } from "../config/schema";
import { host } from "../test/dom";
import { renderStreams } from "./streams";

afterEach(() => {
  document.body.replaceChildren();
});

const connection = (id: string, service: Service): Connection => ({
  id,
  name: id,
  service,
});
const stream = (id: string, connectionId: string, collapsed = false): Stream => ({
  id,
  title: `Stream ${id}`,
  connectionId,
  collapsedByDefault: collapsed,
});
const noop = (): void => {};

describe("renderStreams", () => {
  it("renders a panel per stream, open by default, with the brand mark", () => {
    const root = host();
    renderStreams(
      root,
      { streams: [stream("s1", "c1")], connections: [connection("c1", "notion")], expanded: {} },
      { navigate: noop, onToggle: noop },
    );
    expect(root.querySelector<HTMLDetailsElement>(".cc-stream")?.open).toBe(true);
    expect(root.querySelector(".cc-brand")).not.toBeNull();
  });

  it("collapses when the stream says so", () => {
    const root = host();
    renderStreams(
      root,
      { streams: [stream("s1", "c1", true)], connections: [connection("c1", "linear")], expanded: {} },
      { navigate: noop, onToggle: noop },
    );
    expect(root.querySelector<HTMLDetailsElement>(".cc-stream")?.open).toBe(false);
  });

  it("shows a loading note before a result arrives", () => {
    const root = host();
    renderStreams(
      root,
      { streams: [stream("s1", "c1")], connections: [connection("c1", "notion")], expanded: {} },
      { navigate: noop, onToggle: noop },
    );
    expect(root.querySelector(".cc-stream__empty")?.textContent).toBe("Loading…");
  });

  it("prompts to connect when the connection needs auth", () => {
    const root = host();
    renderStreams(
      root,
      {
        streams: [stream("s1", "c1")],
        connections: [connection("c1", "notion")],
        expanded: {},
        integrationResults: { c1: { status: "needs_auth" } },
      },
      { navigate: noop, onToggle: noop },
    );
    expect(root.querySelector(".cc-stream__empty")?.textContent).toContain("Connect");
  });

  it("renders items and navigates", () => {
    const navigate = vi.fn();
    const root = host();
    renderStreams(
      root,
      {
        streams: [stream("s1", "c1")],
        connections: [connection("c1", "notion")],
        expanded: {},
        integrationResults: {
          c1: { status: "ok", items: [{ id: "1", title: "Roadmap item", url: "https://notion.so/x" }] },
        },
      },
      { navigate, onToggle: noop },
    );
    expect(root.querySelector(".cc-stream__item-title")?.textContent).toBe("Roadmap item");
    root.querySelector<HTMLButtonElement>(".cc-stream__item")?.click();
    expect(navigate).toHaveBeenCalledWith("https://notion.so/x");
  });

  it("reports toggles by stream id", () => {
    const onToggle = vi.fn();
    const root = host();
    renderStreams(
      root,
      { streams: [stream("s1", "c1")], connections: [connection("c1", "notion")], expanded: {} },
      { navigate: noop, onToggle },
    );
    const details = root.querySelector<HTMLDetailsElement>(".cc-stream");
    if (details === null) throw new Error("no details");
    details.open = false;
    details.dispatchEvent(new Event("toggle"));
    expect(onToggle).toHaveBeenCalledWith("s1", false);
  });

  it("skips a stream whose connection is role tasks (it lives in the lane)", () => {
    const root = host();
    renderStreams(
      root,
      {
        streams: [stream("s1", "c1"), stream("s2", "c2")],
        connections: [
          { id: "c1", name: "Notes", service: "notion" },
          { id: "c2", name: "Tasks", service: "notion", role: "tasks" },
        ],
        expanded: {},
      },
      { navigate: noop, onToggle: noop },
    );
    const titles = [...root.querySelectorAll(".cc-stream__title")].map((node) => node.textContent);
    expect(titles).toEqual(["Stream s1"]);
  });

  it("skips a Linear inbox-view connection on the right (it lives in the lane)", () => {
    const root = host();
    renderStreams(
      root,
      {
        streams: [stream("s1", "c1"), stream("s2", "c2")],
        connections: [
          { id: "c1", name: "Assigned", service: "linear" },
          { id: "c2", name: "Inbox", service: "linear", linearView: "inbox" },
        ],
        expanded: {},
      },
      { navigate: noop, onToggle: noop },
    );
    const titles = [...root.querySelectorAll(".cc-stream__title")].map((node) => node.textContent);
    expect(titles).toEqual(["Stream s1"]);
  });
});
