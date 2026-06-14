import { describe, expect, it } from "vitest";

import { ManifestActionSchema } from "./actions";

describe("ManifestActionSchema", () => {
  it("accepts an action with only a urlTemplate", () => {
    const action = { id: "open", urlTemplate: "linearbar://open?url={url}" };

    expect(ManifestActionSchema.safeParse(action).success).toBe(true);
  });

  it("accepts an action with only a route", () => {
    const action = { id: "join", route: "commandcenter://join" };

    expect(ManifestActionSchema.safeParse(action).success).toBe(true);
  });

  it("rejects an action that declares both a template and a route", () => {
    const action = {
      id: "open",
      urlTemplate: "x://y",
      route: "commandcenter://join",
    };

    expect(ManifestActionSchema.safeParse(action).success).toBe(false);
  });

  it("rejects an action that declares neither", () => {
    expect(ManifestActionSchema.safeParse({ id: "open" }).success).toBe(false);
  });
});
