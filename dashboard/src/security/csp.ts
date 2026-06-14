/**
 * The content security policy for the new tab page. Scripts and styles come
 * only from the extension itself, and the only outbound connection allowed is
 * the weather host. This blocks any injected script from a malformed feed value
 * from running or phoning home. See docs/06-safari-extension.md.
 */

const WEATHER_HOST = "https://api.open-meteo.com";

interface CspDirectives {
  connectSrc: string[];
}

function render(directives: CspDirectives): string {
  return [
    "default-src 'self'",
    `connect-src 'self' ${directives.connectSrc.join(" ")}`,
    "img-src 'self' https: data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self'",
  ].join("; ");
}

export interface BuildCspOptions {
  /** Extra hosts allowed for outbound connections, in addition to the weather host. */
  connectSrc?: string[];
}

export function buildCsp(options: BuildCspOptions = {}): string {
  return render({ connectSrc: [WEATHER_HOST, ...(options.connectSrc ?? [])] });
}

export const DEFAULT_CSP = buildCsp();
