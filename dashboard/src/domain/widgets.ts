import { z } from "zod";

import { ActionRefSchema } from "./actions";
import {
  GlanceSchema,
  IsoInstantSchema,
  SizeSchema,
  ToneSchema,
  TrendSchema,
} from "./primitives";

/**
 * The fixed widget vocabulary. Providers may only use these types, and every
 * theme must be able to render all of them. See docs/13-representation-model.md.
 * A fixed vocabulary is what lets two open communities, providers and themes,
 * coexist: any theme can render any provider, and no provider ships pixels.
 */

// metric -------------------------------------------------------------------

export const MetricWidgetSchema = z.object({
  type: z.literal("metric"),
  title: z.string().optional(),
  data: z.object({
    value: z.string().min(1),
    label: z.string().optional(),
    tone: ToneSchema.optional(),
    trend: TrendSchema.optional(),
    delta: z.string().optional(),
  }),
});

// list ---------------------------------------------------------------------

const LeadingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("avatar"), url: z.string() }),
  z.object({ kind: z.literal("icon"), name: z.string() }),
  z.object({ kind: z.literal("colorDot"), colorHex: z.string() }),
]);

const TrailingSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("badge"), text: z.string(), tone: ToneSchema.optional() }),
  z.object({ kind: z.literal("text"), text: z.string() }),
  z.object({ kind: z.literal("time"), iso: IsoInstantSchema }),
]);

const ListItemSchema = z.object({
  leading: LeadingSchema.optional(),
  title: z.string(),
  subtitle: z.string().optional(),
  trailing: TrailingSchema.optional(),
  action: ActionRefSchema.optional(),
});
export type ListItem = z.infer<typeof ListItemSchema>;

export const ListWidgetSchema = z.object({
  type: z.literal("list"),
  title: z.string().optional(),
  data: z.object({ items: z.array(ListItemSchema) }),
});

// table --------------------------------------------------------------------

const ColumnSchema = z.object({
  key: z.string().min(1),
  label: z.string(),
  type: z.enum(["text", "number", "date", "badge", "progress"]),
  unit: z.string().optional(),
});

const CellSchema = z.union([
  z.string(),
  z.number(),
  z.object({ text: z.string(), tone: ToneSchema.optional() }),
  z.object({ value: z.number() }),
]);

export const TableWidgetSchema = z.object({
  type: z.literal("table"),
  title: z.string().optional(),
  data: z.object({
    columns: z.array(ColumnSchema).min(1),
    rows: z.array(z.record(z.string(), CellSchema)),
  }),
});

// chart --------------------------------------------------------------------

const PointSchema = z.object({
  x: z.union([z.string(), z.number()]),
  y: z.number(),
});

const SeriesSchema = z.object({
  name: z.string(),
  points: z.array(PointSchema),
  colorHex: z.string().optional(),
});

export const ChartWidgetSchema = z.object({
  type: z.literal("chart"),
  title: z.string().optional(),
  data: z.object({
    subtype: z.enum(["line", "area", "bar", "sparkline", "donut", "gauge"]),
    xType: z.enum(["time", "category", "number"]),
    yLabel: z.string().optional(),
    series: z.array(SeriesSchema).min(1),
  }),
});

// timeline -----------------------------------------------------------------

const TimelineItemSchema = z.object({
  start: IsoInstantSchema,
  end: IsoInstantSchema.optional(),
  label: z.string(),
  tone: ToneSchema.optional(),
  action: ActionRefSchema.optional(),
});

export const TimelineWidgetSchema = z.object({
  type: z.literal("timeline"),
  title: z.string().optional(),
  data: z.object({
    from: IsoInstantSchema,
    to: IsoInstantSchema,
    items: z.array(TimelineItemSchema),
  }),
});

// progress -----------------------------------------------------------------

export const ProgressWidgetSchema = z.object({
  type: z.literal("progress"),
  title: z.string().optional(),
  data: z.object({
    value: z.number().min(0).max(1),
    label: z.string().optional(),
    tone: ToneSchema.optional(),
  }),
});

// text ---------------------------------------------------------------------

export const TextWidgetSchema = z.object({
  type: z.literal("text"),
  title: z.string().optional(),
  data: z.object({
    body: z.string(),
    emphasis: z.enum(["normal", "muted"]).optional(),
  }),
});

// union --------------------------------------------------------------------

export const WidgetSchema = z.discriminatedUnion("type", [
  MetricWidgetSchema,
  ListWidgetSchema,
  TableWidgetSchema,
  ChartWidgetSchema,
  TimelineWidgetSchema,
  ProgressWidgetSchema,
  TextWidgetSchema,
]);
export type Widget = z.infer<typeof WidgetSchema>;
export type WidgetType = Widget["type"];

/** A card is what a provider publishes: a header, a glance, and widgets. */
export const CardSchema = z.object({
  title: z.string().optional(),
  icon: z.string().optional(),
  accentColorHex: z.string().optional(),
  glance: GlanceSchema,
  preferredSize: SizeSchema.optional(),
  widgets: z.array(WidgetSchema),
});
export type Card = z.infer<typeof CardSchema>;
