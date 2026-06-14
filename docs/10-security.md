# Security

The design has one core promise: no OAuth token ever crosses an app boundary. Everything here protects that.

## Token ownership

Each provider owns its own tokens, in its own Keychain items, and refreshes them itself.

- Linear Bar keeps its Linear tokens under service `com.strategicnerds.LinearBar` and uses its own token-exchange worker.
- Meeting Notifier keeps its Google and Microsoft tokens under service `com.strategicnerds.meetingnotifier`, marked device-local, non-syncing.
- Command Center holds no provider tokens at all. It reads finished feeds.

Because Command Center never reads tokens, a compromise of the dashboard or the extension cannot leak credentials it does not have.

## What lives in the shared container

The App Group container holds only finished, non-secret data:

- Provider manifests.
- Provider feeds, which are display data: event titles, times, inbox rows, links the user can already see in the source app.
- Command Center settings, which are preferences.

It must never hold tokens, refresh tokens, client secrets, or API keys. This is a review checklist item for every feed: confirm no secret field is being serialized. Avoid serializing raw attendee email lists if not needed for display; prefer names and counts, which the schema already favors.

## Why not a shared Keychain group

A shared Keychain group would let Command Center read provider tokens directly. We rejected it because:

- It would require Command Center to hold every provider's client secret to refresh tokens, spreading secrets across more binaries.
- Two processes refreshing the same token race and can invalidate each other.
- A single readable group widens the blast radius of any one app's compromise.

The feed model keeps each app's secrets inside that app, which is the smaller and safer surface.

## Client secrets stay in their owners

Linear Bar embeds a Linear client secret and uses a Cloudflare worker for exchange. Meeting Notifier uses Google and Microsoft secrets via its own flow. Command Center introduces no new secret and proxies none. If a future provider needs a confidential OAuth flow, the secret lives in that provider or its own backend, never in Command Center and never in the container.

## Sandbox and entitlements

- The Safari extension requests only `nativeMessaging`. No host permissions, because it injects nothing into third-party sites. It serves its own bundled page.
- The extension handler reads the App Group container and returns display data. It cannot launch browsers, by sandbox design, which is why link opening is delegated to the main app.
- The main app opens links with `NSWorkspace`. Restrict opened URLs to an allowlist of known meeting and provider hosts before launching a browser, mirroring Meeting Notifier's strict host allowlist for meeting links. Never pass an arbitrary URL straight to `NSWorkspace.open`.

## URL scheme hardening

The `commandcenter://` scheme is an entry point any app can call, so validate every parameter.

- `join`: require a `url` that parses and whose host is on the meeting allowlist. Reject `file://`, `javascript:`, and unknown schemes. Decode once, validate, then open.
- `openProvider`: require a known `providerId`; the native handler resolves it to the installed provider's bundle id and launches that app (it ignores a missing/unknown provider). Any optional `url` must be a non-dangerous scheme. Per-provider host-domain matching of the url is a planned hardening.
- Drop anything that fails validation silently. Do not surface attacker-controlled strings in alerts.

## Content security policy

The dashboard ships a strict CSP, allowing scripts and styles only from self and outbound connections only to the weather host. This blocks injected script from a malformed feed value. Treat all feed text as untrusted and render it as text, never as HTML. No `innerHTML` with feed content.

## Privacy

- Feeds contain personal schedule and inbox data. They sit in a per-user container protected by file permissions and the App Group sandbox. Do not copy them elsewhere.
- Weather requests go to Open-Meteo by latitude and longitude for a user-chosen city. No precise device geolocation is requested, so there is no location prompt and no continuous tracking.
- No analytics on feed contents. If product analytics are added later, never log titles, attendees, links, or inbox text.

## The local endpoint

Opening the platform to any app adds a local ingest endpoint, defined in [12-transports-and-ingest.md](12-transports-and-ingest.md). It listens only on loopback, so it is never reachable from the network. The new risk is that any local process can reach loopback, so identity comes from explicit user consent, not from the connection.

- Registration is gated by a user prompt. A provider receives a capability token only after the user approves it by name.
- Every publish carries that token. A request without a valid token is refused.
- Tokens are revocable in the providers screen, and revocation takes effect at once.
- The endpoint accepts only the published protocol. It is an ingest of display data, never a command channel. It cannot be asked to read tokens, open URLs on its own, or run code.
- Where stronger caller identity is wanted, a Unix domain socket variant yields the peer process id and its code signature, at the cost of more sandbox friction. Loopback with consent is the default.

## Theme code

Render themes run code in the new tab page and can see the glanceable data on screen, so they are treated as trusted code, per [14-themes.md](14-themes.md).

- Token themes carry no code and are safe by construction. They are the default tier and can be offered freely.
- Render themes are installed explicitly, with the author shown and a plain note that the theme can see what is displayed.
- The theme execution context has a content security policy of `connect-src 'none'`, so a theme cannot send what it draws anywhere.
- Themes render into isolated shadow roots and cannot read across cards. They invoke actions through the platform, which still validates every URL. A theme cannot open an arbitrary URL.

## Review checklist before shipping a feed change

1. Does any serialized field carry a secret or token? It must not.
2. Are writes atomic, so a reader cannot see a partial file?
3. Does the dashboard render every feed string as text, not HTML?
4. Are opened URLs validated against the host allowlist?
5. Does `status` correctly become `needs_auth` when the user must re-authorize, so the dashboard never silently shows stale private data as current?
