import { describe, expect, it } from "vitest";

import { makeFeedEnvelope, makeGlance } from "../test/factories";
import { isFeedFresh, parseFeedEnvelope } from "./feed";

describe("parseFeedEnvelope", () => {
  it("accepts a well-formed feed", () => {
    const result = parseFeedEnvelope(makeFeedEnvelope());
    expect(result.ok).toBe(true);
  });

  it("rejects a feed with no glance line, since every feed must carry one", () => {
    const { glance: _glance, ...withoutGlance } = makeFeedEnvelope();
    const result = parseFeedEnvelope(withoutGlance);

    expect(result.ok).toBe(false);
  });

  it("rejects a glance whose value is empty", () => {
    const result = parseFeedEnvelope(
      makeFeedEnvelope({ glance: makeGlance({ value: "" }) }),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects an unknown status", () => {
    const result = parseFeedEnvelope(
      makeFeedEnvelope({ status: "exploded" as never }),
    );

    expect(result.ok).toBe(false);
  });

  it("rejects an updatedAt that is not a real date", () => {
    const result = parseFeedEnvelope(
      makeFeedEnvelope({ updatedAt: "not-a-date" }),
    );

    expect(result.ok).toBe(false);
  });

  it("refuses a feed from a future schema version, so it never renders as current", () => {
    const result = parseFeedEnvelope(makeFeedEnvelope({ schemaVersion: 2 }));

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("schemaVersion");
    }
  });
});

describe("isFeedFresh", () => {
  it("treats a feed within its ttl as fresh", () => {
    const envelope = makeFeedEnvelope({
      updatedAt: "2026-06-14T15:00:00Z",
      ttlSeconds: 300,
    });

    expect(isFeedFresh(envelope, new Date("2026-06-14T15:04:00Z"))).toBe(true);
  });

  it("treats a feed past its ttl as stale", () => {
    const envelope = makeFeedEnvelope({
      updatedAt: "2026-06-14T15:00:00Z",
      ttlSeconds: 300,
    });

    expect(isFeedFresh(envelope, new Date("2026-06-14T15:10:00Z"))).toBe(false);
  });

  it("treats a feed with no ttl as always fresh", () => {
    const { ttlSeconds: _ttl, ...rest } = makeFeedEnvelope();
    const envelope = { ...rest };

    expect(isFeedFresh(envelope, new Date("2030-01-01T00:00:00Z"))).toBe(true);
  });
});
