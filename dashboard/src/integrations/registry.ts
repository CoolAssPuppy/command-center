import { githubIntegration } from "./github";
import { googleCalendarIntegration } from "./googleCalendar";
import { linearIntegration } from "./linear";
import { notionIntegration } from "./notion";
import { todoistIntegration } from "./todoist";
import type { Integration } from "./types";

/**
 * The available integrations. New sources join this list; the work-stream shell
 * and edit pane discover them here, so nothing else changes when one is added.
 */
export const INTEGRATIONS: Integration[] = [
  googleCalendarIntegration,
  linearIntegration,
  notionIntegration,
  githubIntegration,
  todoistIntegration,
];

export function integrationById(id: string): Integration | undefined {
  return INTEGRATIONS.find((integration) => integration.id === id);
}
