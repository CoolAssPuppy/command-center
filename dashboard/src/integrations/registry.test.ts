import { describe, expect, it } from "vitest";

import { INTEGRATIONS, integrationById } from "./registry";

describe("integration registry", () => {
  it("exposes Notion", () => {
    expect(integrationById("notion")?.displayName).toBe("Notion");
  });

  it("returns undefined for an unknown id", () => {
    expect(integrationById("nope")).toBeUndefined();
  });

  it("gives every integration a unique id", () => {
    const ids = INTEGRATIONS.map((integration) => integration.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
