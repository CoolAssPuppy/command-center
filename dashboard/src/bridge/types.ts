/**
 * The bridge is how the dashboard gets its data. In Safari it is the native
 * messaging handler; in local dev it is a mock returning fixtures. The dashboard
 * depends only on this interface, never on a concrete transport, and the result
 * is unknown so it is always validated before use. See docs/06-safari-extension.md.
 */
export interface DashboardBridge {
  getDashboard(): Promise<unknown>;
}
