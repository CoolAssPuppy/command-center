import "@fontsource-variable/archivo";
import "./styles.css";

import { runDashboard } from "./app/run";
import { createEnvironmentStore } from "./config/store";
import { devProxyFetch, devUnsplashFetch } from "./integrations/devProxy";
import { measureFirstPaint } from "./perf/perf";
import { isSafeUrl } from "./security/url";

/**
 * New tab entry point. It selects the right config store for the environment
 * (chrome.storage in the extension, localStorage in dev), paints instantly from
 * cache, and keeps the clock ticking. The store is the only thing that differs
 * across environments.
 */
const mount = document.getElementById("app");
if (mount) {
  const store = createEnvironmentStore();
  const { withinBudget, elapsedMs } = measureFirstPaint(() => {
    void runDashboard({
      mount,
      store,
      now: () => new Date(),
      navigate: (url) => {
        // The invariant lives at the sink, not just every call site: an unsafe
        // scheme never becomes a live navigation, even if a future caller forgets.
        if (isSafeUrl(url)) window.location.href = url;
      },
      scheduleTick: (cb) => {
        window.setInterval(cb, 60_000);
      },
      // In dev, route Notion/Linear/Google/Unsplash through the Vite proxy to
      // dodge CORS from the localhost origin.
      ...(import.meta.env.DEV
        ? { httpFetch: devProxyFetch, unsplashFetch: devUnsplashFetch }
        : {}),
    });
  });
  if (!withinBudget) {
    console.warn(`First paint ${elapsedMs.toFixed(0)}ms exceeded budget`);
  }
}
