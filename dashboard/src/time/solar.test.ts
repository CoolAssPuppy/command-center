import { describe, expect, it } from "vitest";

import { phaseLabel } from "./solar";

describe("phaseLabel", () => {
  it("names each band of the day and closes over the night hours", () => {
    expect(phaseLabel(5)).toBe("Pre-dawn");
    expect(phaseLabel(7)).toBe("Dawn");
    expect(phaseLabel(9)).toBe("Morning");
    expect(phaseLabel(14)).toBe("Afternoon");
    expect(phaseLabel(18)).toBe("Evening");
    expect(phaseLabel(23)).toBe("Night");
    expect(phaseLabel(2)).toBe("Night");
  });

  it("uses half-open bounds so each hour lands in exactly one band", () => {
    expect(phaseLabel(4)).toBe("Pre-dawn");
    expect(phaseLabel(6)).toBe("Dawn");
    expect(phaseLabel(8)).toBe("Morning");
    expect(phaseLabel(12)).toBe("Afternoon");
    expect(phaseLabel(17)).toBe("Evening");
    expect(phaseLabel(20)).toBe("Night");
  });
});
