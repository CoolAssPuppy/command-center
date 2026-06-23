import { afterEach, describe, expect, it } from "vitest";

import type { Zone } from "../config/schema";
import { host } from "../test/dom";
import { renderMeetingWindow } from "./meetingWindow";

afterEach(() => {
  document.body.replaceChildren();
});

const home: Zone = {
  id: "home",
  label: "Lisbon",
  timeZone: "Europe/Lisbon",
  isHome: true,
};
const now = new Date(Date.UTC(2026, 5, 15, 16, 0, 0));

describe("renderMeetingWindow", () => {
  it("renders a track per zone, a verdict, and a now cursor", () => {
    const root = host();
    renderMeetingWindow(root, {
      now,
      homeZone: home,
      zones: [
        home,
        { id: "ny", label: "New York", timeZone: "America/New_York" },
        { id: "syd", label: "Sydney", timeZone: "Australia/Sydney" },
      ],
    });
    expect(root.querySelectorAll(".cc-mw__track")).toHaveLength(3);
    expect(root.querySelector(".cc-mw__headline")?.textContent).toContain("3");
    expect(root.querySelector(".cc-mw__cursor")).not.toBeNull();
  });
});
