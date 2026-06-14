import "./styles.css";

import { runDashboard } from "./app/run";
import { createMockBridge } from "./bridge/mock";
import { measureFirstPaint } from "./perf/perf";

/**
 * Dashboard entry point. In dev and the demo this runs against the mock bridge.
 * In the Safari extension, main is built with a native bridge instead (P2.4).
 */
const mount = document.getElementById("app");
if (mount) {
  const { withinBudget, elapsedMs } = measureFirstPaint(() => {
    void runDashboard({
      mount,
      bridge: createMockBridge(),
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
