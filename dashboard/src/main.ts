import "./styles.css";

import { runDashboard } from "./app/run";
import type { DashboardBridge } from "./bridge/types";
import { createMockBridge } from "./bridge/mock";
import { createNativeBridge, getExtensionRuntime } from "./bridge/native";
import { measureFirstPaint } from "./perf/perf";

/**
 * Pick the data source. A "mock" build forces the demo fixtures (used for the
 * unsigned Safari visual test). Otherwise use the native handler when running
 * inside the extension, and the mock fixtures in plain-browser local dev.
 */
function selectBridge(): DashboardBridge {
  if (import.meta.env.VITE_BRIDGE === "mock") return createMockBridge();
  const runtime = getExtensionRuntime();
  return runtime !== undefined ? createNativeBridge(runtime) : createMockBridge();
}

/**
 * Dashboard entry point. It paints from cache, then renders live bridge data,
 * then weather. The bridge is the only thing that differs across environments.
 */
const mount = document.getElementById("app");
if (mount) {
  const { withinBudget, elapsedMs } = measureFirstPaint(() => {
    void runDashboard({
      mount,
      bridge: selectBridge(),
      now: () => new Date(),
      navigate: (url) => {
        window.location.href = url;
      },
    });
  });
  if (!withinBudget) {
    console.warn(`First paint ${elapsedMs.toFixed(0)}ms exceeded budget`);
  }
}
