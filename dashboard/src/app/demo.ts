import type { IntegrationResult } from "../integrations/types";

/**
 * A hidden demo mode for screenshots. When localStorage "cc:demo" is "1" (or the
 * url has ?demo), the integrations serve canned data instead of fetching, so the
 * data cards look populated without connecting real accounts. Inert otherwise.
 */
export function isDemoMode(): boolean {
  try {
    const scope = globalThis as {
      localStorage?: Storage;
      location?: { search?: string };
    };
    if (scope.location?.search?.includes("demo") === true) return true;
    return scope.localStorage?.getItem("cc:demo") === "1";
  } catch {
    return false;
  }
}

const calendar: IntegrationResult = {
  status: "ok",
  items: [
    { id: "d-c1", title: "Standup", subtitle: "9:00 AM", sortKey: "2026-06-24T09:00" },
    { id: "d-c2", title: "Design review", subtitle: "11:30 AM", meta: "Zoom", sortKey: "2026-06-24T11:30" },
    { id: "d-c3", title: "Lunch with Sam", subtitle: "12:30 PM", sortKey: "2026-06-24T12:30" },
    { id: "d-c4", title: "1:1 with Alex", subtitle: "3:00 PM", sortKey: "2026-06-24T15:00" },
    { id: "d-c5", title: "Ship review", subtitle: "4:30 PM", meta: "War room", sortKey: "2026-06-24T16:30" },
  ],
};

const linear: IntegrationResult = {
  status: "ok",
  items: [
    { id: "d-l1", title: "Fix flaky auth test", meta: "In Progress" },
    { id: "d-l2", title: "Dark mode polish", meta: "Todo" },
    { id: "d-l3", title: "Investigate slow dashboard query", meta: "In Review" },
    { id: "d-l4", title: "Update onboarding copy", meta: "Todo" },
    { id: "d-l5", title: "Add keyboard shortcuts", meta: "Backlog" },
  ],
};

const notion: IntegrationResult = {
  status: "ok",
  items: [
    { id: "d-n1", title: "Q3 planning doc" },
    { id: "d-n2", title: "Brand voice guide" },
    { id: "d-n3", title: "Launch checklist" },
    { id: "d-n4", title: "Competitive teardown" },
  ],
};

/** Canned results for a service, and the merged calendar for combined cards. */
export function demoResultFor(service: string): IntegrationResult {
  if (service === "linear") return linear;
  if (service === "notion") return notion;
  return calendar;
}

export const demoCombinedCalendars = calendar;
