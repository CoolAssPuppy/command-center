import { describe, expect, it } from "vitest";

import { detectConference, providerForUrl } from "./conference";

describe("providerForUrl", () => {
  it("classifies known video hosts", () => {
    expect(providerForUrl("https://meet.google.com/abc-defg-hij")).toBe("meet");
    expect(providerForUrl("https://acme.zoom.us/j/123")).toBe("zoom");
    expect(providerForUrl("https://teams.microsoft.com/l/meetup-join/x")).toBe("teams");
    expect(providerForUrl("https://example.com/call")).toBe("other");
    expect(providerForUrl("not a url")).toBeUndefined();
  });
});

describe("detectConference", () => {
  it("treats a Hangouts link as Google Meet", () => {
    const link = detectConference({ hangoutLink: "https://meet.google.com/abc-defg-hij" });
    expect(link).toEqual({ joinUrl: "https://meet.google.com/abc-defg-hij", provider: "meet" });
  });

  it("prefers a recognized entry point over an unknown one", () => {
    const link = detectConference({
      entryPointUris: ["https://example.com/x", "https://acme.zoom.us/j/9"],
    });
    expect(link).toEqual({ joinUrl: "https://acme.zoom.us/j/9", provider: "zoom" });
  });

  it("scans free text (location, description) for a link", () => {
    const link = detectConference({
      texts: ["Room 4", "Join at https://teams.microsoft.com/l/meetup-join/z please"],
    });
    expect(link?.provider).toBe("teams");
  });

  it("returns undefined when there is no link", () => {
    expect(detectConference({ texts: ["In person, room 2"] })).toBeUndefined();
  });
});
