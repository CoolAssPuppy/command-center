import type { ConferenceProvider } from "./types";

/**
 * Detect a video-call link on a calendar event, with no network calls. It looks
 * at the Hangouts link, the conferenceData video entry points, and any URL in
 * the location or description, and classifies the provider by host. The first
 * recognized link wins; an unrecognized link still returns as "other" so a Join
 * button can appear, but only when nothing better is found.
 */
export interface ConferenceSource {
  hangoutLink?: string;
  /** URIs from conferenceData.entryPoints whose entryPointType is "video". */
  entryPointUris?: string[];
  /** Free text that may carry a link: the location and description. */
  texts?: string[];
}

export interface ConferenceLink {
  joinUrl: string;
  provider: ConferenceProvider;
}

const URL_PATTERN = /https?:\/\/[^\s<>"')]+/g;

/** Classify a URL's host into a known provider, or undefined if unparseable. */
export function providerForUrl(url: string): ConferenceProvider | undefined {
  let host: string;
  try {
    host = new URL(url).host.toLowerCase();
  } catch {
    return undefined;
  }
  if (host === "meet.google.com") return "meet";
  if (host === "zoom.us" || host.endsWith(".zoom.us")) return "zoom";
  if (host === "teams.microsoft.com" || host.endsWith(".teams.microsoft.com")) return "teams";
  return "other";
}

function knownLink(url: string): ConferenceLink | undefined {
  const provider = providerForUrl(url);
  if (provider === undefined || provider === "other") return undefined;
  return { joinUrl: url, provider };
}

export function detectConference(source: ConferenceSource): ConferenceLink | undefined {
  // A Hangouts link is always Google Meet.
  if (source.hangoutLink !== undefined && source.hangoutLink.length > 0) {
    return { joinUrl: source.hangoutLink, provider: "meet" };
  }

  // Prefer a recognized provider from the structured entry points.
  for (const uri of source.entryPointUris ?? []) {
    const link = knownLink(uri);
    if (link !== undefined) return link;
  }

  // Then scan free text for a recognized provider link.
  const found: string[] = [];
  for (const text of source.texts ?? []) {
    found.push(...(text.match(URL_PATTERN) ?? []));
  }
  for (const url of found) {
    const link = knownLink(url);
    if (link !== undefined) return link;
  }

  // Fall back to the first entry-point or text URL as an "other" provider.
  const firstUri = (source.entryPointUris ?? [])[0] ?? found[0];
  if (firstUri !== undefined && providerForUrl(firstUri) !== undefined) {
    return { joinUrl: firstUri, provider: "other" };
  }
  return undefined;
}
