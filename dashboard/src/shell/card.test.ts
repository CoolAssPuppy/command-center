import { fireEvent, getByRole, getByText, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { host } from "../test/dom";

import { makePlacedCard } from "../test/dashboard-factories";
import { renderCard, type CardDeps } from "./card";

afterEach(() => {
  document.body.replaceChildren();
});

function deps(overrides: Partial<CardDeps> = {}): CardDeps {
  return {
    navigate: vi.fn(),
    formatTime: () => "10:00 AM",
    reducedMotion: false,
    ...overrides,
  };
}

describe("renderCard", () => {
  it("shows the glance in the header", () => {
    const root = host();
    renderCard(root, makePlacedCard({ presentation: "full" }), deps());

    expect(getByText(root, "3")).toBeInTheDocument();
    expect(getByText(root, "unread")).toBeInTheDocument();
  });

  it("paints widgets only for a full ready card", () => {
    const root = host();
    renderCard(root, makePlacedCard({ presentation: "glance" }), deps());

    expect(root.querySelector(".cc-card__body .cc-widget")).toBeNull();
  });

  it("renders a reconnect button for needs_auth that launches the provider", () => {
    const root = host();
    const navigate = vi.fn();
    const card = makePlacedCard({ state: "needs_auth", card: null });

    renderCard(root, card, deps({ navigate }));
    fireEvent.click(getByRole(root, "button", { name: /Reconnect in Linear/ }));

    expect(navigate).toHaveBeenCalledOnce();
    const url = navigate.mock.calls[0]?.[0] as string;
    expect(url.startsWith("commandcenter://openProvider")).toBe(true);
    expect(url).toContain("providerId=linear-bar");
  });

  it("shows a quiet notice for an error card and no reconnect button", () => {
    const root = host();
    renderCard(root, makePlacedCard({ state: "error", card: null }), deps());

    expect(getByText(root, /Couldn't load/)).toBeInTheDocument();
    expect(queryByRole(root, "button")).toBeNull();
  });

  it("shows an age note when the data is stale", () => {
    const root = host();
    renderCard(
      root,
      makePlacedCard({ fresh: false, ageSeconds: 420, presentation: "full" }),
      deps(),
    );

    expect(getByText(root, "updated 7m ago")).toBeInTheDocument();
  });
});
