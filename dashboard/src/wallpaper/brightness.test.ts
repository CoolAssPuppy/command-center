import { describe, expect, it } from "vitest";

import { analyzePhotoTone } from "./brightness";

describe("analyzePhotoTone", () => {
  it("assumes dark (the light-text default) for an unsafe or non-https URL", async () => {
    await expect(analyzePhotoTone("javascript:alert(1)")).resolves.toBe("dark");
    await expect(analyzePhotoTone("http://insecure.example/pic.jpg")).resolves.toBe("dark");
    await expect(analyzePhotoTone("not a url")).resolves.toBe("dark");
  });
});
