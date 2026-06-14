import { el } from "./render/helpers";

/**
 * Dashboard entry point. This is a placeholder bootstrap so the build pipeline
 * is green from the start. The full shell, instant paint from cache, native
 * bridge, header, and card grid, is built in task P1.11.
 */
function bootstrap(): void {
  const mount = document.getElementById("app");
  if (!mount) return;
  mount.appendChild(el("div", "cc-app", "Command Center"));
}

bootstrap();
