import { describe, expect, it } from "vitest";

import {
  makeCard,
  makeChartWidget,
  makeListWidget,
  makeMetricWidget,
} from "../test/factories";
import { CardSchema, WidgetSchema } from "./widgets";

describe("WidgetSchema", () => {
  it("accepts each widget type in the vocabulary", () => {
    expect(WidgetSchema.safeParse(makeMetricWidget()).success).toBe(true);
    expect(WidgetSchema.safeParse(makeListWidget()).success).toBe(true);
    expect(WidgetSchema.safeParse(makeChartWidget()).success).toBe(true);
  });

  it("rejects a widget type outside the vocabulary", () => {
    const rogue = { type: "iframe", data: { src: "https://evil.example" } };

    expect(WidgetSchema.safeParse(rogue).success).toBe(false);
  });

  it("rejects a progress value outside zero to one", () => {
    const widget = { type: "progress", data: { value: 1.5 } };

    expect(WidgetSchema.safeParse(widget).success).toBe(false);
  });

  it("rejects a chart with no series", () => {
    const widget = {
      type: "chart",
      data: { subtype: "line", xType: "time", series: [] },
    };

    expect(WidgetSchema.safeParse(widget).success).toBe(false);
  });

  it("rejects a list time trailing whose value is not a date", () => {
    const widget = {
      type: "list",
      data: {
        items: [{ title: "x", trailing: { kind: "time", iso: "soon" } }],
      },
    };

    expect(WidgetSchema.safeParse(widget).success).toBe(false);
  });
});

describe("CardSchema", () => {
  it("accepts a complete card", () => {
    expect(CardSchema.safeParse(makeCard()).success).toBe(true);
  });

  it("requires a glance line on the card", () => {
    const { glance: _glance, ...withoutGlance } = makeCard();

    expect(CardSchema.safeParse(withoutGlance).success).toBe(false);
  });

  it("accepts a card with an empty widget list, rendered from its glance alone", () => {
    expect(CardSchema.safeParse(makeCard({ widgets: [] })).success).toBe(true);
  });
});
