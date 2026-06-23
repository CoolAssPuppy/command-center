import { z } from "zod";
import { describe, expect, it } from "vitest";

import { firstIssue } from "./result";

describe("firstIssue", () => {
  it("returns the first zod issue message", () => {
    const parsed = z.object({ n: z.number() }).safeParse({ n: "not a number" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      expect(firstIssue(parsed.error, "fallback")).not.toBe("fallback");
    }
  });

  it("returns the fallback when there are no issues", () => {
    expect(firstIssue(new z.ZodError([]), "fallback")).toBe("fallback");
  });
});
