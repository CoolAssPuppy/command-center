import { describe, expect, it } from "vitest";

import { makeComposedCard } from "../test/dashboard-factories";
import { makeGlance } from "../test/factories";
import { planLayout } from "./attention";

function presentations(cards: ReturnType<typeof planLayout>): string[] {
  return cards.map((card) => card.presentation);
}

describe("planLayout", () => {
  it("gives the first cards full presentation up to the budget, the rest glance", () => {
    const cards = Array.from({ length: 6 }, (_, i) =>
      makeComposedCard({ providerId: `p${String(i)}` }),
    );

    const plan = planLayout(cards, { maxFull: 4 });

    expect(presentations(plan)).toEqual([
      "full",
      "full",
      "full",
      "full",
      "glance",
      "glance",
    ]);
  });

  it("promotes an urgent card to full even when it is past the budget", () => {
    const cards = [
      ...Array.from({ length: 5 }, (_, i) =>
        makeComposedCard({ providerId: `p${String(i)}` }),
      ),
      makeComposedCard({
        providerId: "urgent",
        glance: makeGlance({ tone: "urgent" }),
      }),
    ];

    const plan = planLayout(cards, { maxFull: 4 });

    expect(plan[5]?.presentation).toBe("full"); // urgent, beyond budget
    // one full slot was consumed by the urgent card, so only 3 normal go full
    expect(presentations(plan).slice(0, 5)).toEqual([
      "full",
      "full",
      "full",
      "glance",
      "glance",
    ]);
  });

  it("never spends a full slot on an empty or error card", () => {
    const cards = [
      makeComposedCard({ providerId: "empty", state: "empty", card: null }),
      makeComposedCard({ providerId: "err", state: "error", card: null }),
      makeComposedCard({ providerId: "ready" }),
    ];

    const plan = planLayout(cards, { maxFull: 2 });

    expect(plan[0]?.presentation).toBe("glance"); // empty
    expect(plan[1]?.presentation).toBe("glance"); // error
    expect(plan[2]?.presentation).toBe("full"); // the ready card still got the slot
  });

  it("gives a needs_auth card a full slot so its reconnect prompt is seen", () => {
    const cards = [makeComposedCard({ state: "needs_auth", card: null })];

    expect(planLayout(cards, { maxFull: 2 })[0]?.presentation).toBe("full");
  });

  it("honors urgency over the budget when many cards are urgent", () => {
    const cards = Array.from({ length: 6 }, (_, i) =>
      makeComposedCard({
        providerId: `u${String(i)}`,
        glance: makeGlance({ tone: "urgent" }),
      }),
    );

    const plan = planLayout(cards, { maxFull: 2 });

    expect(presentations(plan).every((p) => p === "full")).toBe(true);
  });

  it("preserves the incoming order", () => {
    const cards = [
      makeComposedCard({ providerId: "a" }),
      makeComposedCard({ providerId: "b" }),
    ];

    expect(planLayout(cards).map((c) => c.providerId)).toEqual(["a", "b"]);
  });
});
