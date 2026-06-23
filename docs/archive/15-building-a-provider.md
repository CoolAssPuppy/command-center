# Building a provider

This is the guide for a third-party macOS app developer who wants their app's
signal to appear on the Command Center dashboard. You publish finished,
glanceable data; you keep your own OAuth, tokens, and backend. Command Center
never sees a credential. See [00-vision.md](00-vision.md) and
[12-transports-and-ingest.md](12-transports-and-ingest.md).

A working example lives in `examples/sample-provider`.

## The shape of it

You publish two things into Command Center:

1. A **manifest** describing your provider, its feeds, and its actions.
2. One or more **feeds**, each a JSON envelope carrying a required glance line
   and the data to show.

The contract is in [03-provider-contract.md](03-provider-contract.md); the feed
data shapes are in [04-feed-schemas.md](04-feed-schemas.md) and the widget
vocabulary in [13-representation-model.md](13-representation-model.md). Every feed
must carry a `glance` (a one-line summary). Your data is rendered by the active
theme; you declare intent, the theme paints it.

## The SDK

Add the `CommandCenterKit` Swift package. It gives you one API over two
transports:

```swift
import CommandCenterKit

let center = CommandCenter(
    providerId: "com.example.deploybot",
    displayName: "DeployBot",
    bundleId: "com.example.deploybot",
    transport: FileDropTransport(containerURL: FileDropTransport.wellKnownContainerURL())
)

try await center.register(manifest: manifest)   // your provider manifest (JSON)
try await center.publish(feed, to: "deploys.json")  // a feed envelope (JSON)
```

That is the whole publish path. Call `publish` again whenever your data changes,
as often as makes sense, twice a second or once a day.

## Two transports

- **File drop** (`FileDropTransport`): for non-sandboxed Developer ID apps. It
  writes your manifest and feeds into the well-known directory
  `~/Library/Application Support/Command Center/Providers/<providerId>/`, which
  Command Center scans. No network, no token.
- **Endpoint** (`EndpointTransport`): for sandboxed Mac App Store apps that can
  open a loopback connection but cannot write that directory. It sends your
  manifest and feeds to Command Center's local endpoint.

The same `CommandCenter` API drives either; you choose the transport at
construction.

## The endpoint consent flow

The endpoint path is gated by the user, so a random local process cannot publish
as you:

1. Your app calls `register` over the endpoint. Your provider starts **pending**.
2. The user approves you in Command Center's providers screen. Command Center
   issues a one-time **capability token** and shows it for the user to give to
   you (it is shown once and never stored in the clear).
3. You store that token (the SDK's `KeychainTokenStore` keeps it in the
   Keychain) and present it on every `publish`. The token is a secret: never log
   it.
4. The user can revoke you at any time, which stops your publishes immediately.

File-drop providers need no token; their writes are gated by the user granting
your app access to the shared directory.

## A minimal feed

A card feed with a single metric, mirroring the sample:

```json
{
  "schemaVersion": 1,
  "providerId": "com.example.deploybot",
  "kind": "card",
  "updatedAt": "2026-06-14T15:04:05Z",
  "ttlSeconds": 300,
  "status": "ok",
  "glance": { "value": "2", "label": "deploys today", "tone": "positive", "trend": "up" },
  "data": {
    "card": {
      "title": "DeployBot",
      "glance": { "value": "2", "label": "deploys today", "tone": "positive" },
      "widgets": [
        { "type": "metric", "data": { "value": "2", "label": "today", "tone": "positive" } }
      ]
    }
  }
}
```

For common cases (a calendar, an inbox), use a convenience `kind` from
[04-feed-schemas.md](04-feed-schemas.md) instead of a hand-built card and let the
platform shape it.

## Rules to follow

- Every feed carries a `glance`. A feed without one is rejected.
- Publish display data only. Never put a token, secret, or raw credential in a
  manifest or feed.
- Use the fixed widget vocabulary. Providers declare; themes render. You cannot
  ship HTML, CSS, or JavaScript in a feed.
- Set `status` honestly: `ok`, `stale`, `needs_auth` (the dashboard shows a
  reconnect prompt), `error`, or `disabled`.
