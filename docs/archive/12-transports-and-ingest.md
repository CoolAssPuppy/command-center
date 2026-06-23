# Transports and ingest

This document defines how data gets from a provider into Command Center. The promise to a developer is one line: send data to the endpoint in the published protocol and you are plugged in. Mac App Store apps and Developer ID apps are both supported.

## One protocol, several transports

The protocol is constant. It is the manifest, the feed envelope, and the representation model from documents 03, 04, and 13. What varies is how the bytes arrive. Every transport feeds the same internal ingest pipeline, so a provider's choice of transport never changes how it is rendered.

There are two transports for the first release.

| Transport | Who it is for | Network | Frequency it suits |
| --- | --- | --- | --- |
| File drop | Developer ID apps, no network use | None | Slow. Seconds to a day. |
| Local endpoint | Any app, including sandboxed Mac App Store apps | Loopback only | Any. Live updates every half second are fine. |

A provider may use either. High-frequency, live providers should use the local endpoint over a persistent connection. Slow, batch providers can use the file drop and avoid networking entirely.

## Transport 1: file drop

For non-sandboxed Developer ID apps. The app writes its manifest and feeds into a well-known, user-visible directory, and Command Center scans it.

```text
~/Library/Application Support/Command Center/Providers/<reverse-dns-id>/
  manifest.json
  feeds/<kind>.json
```

Writes must be atomic, temp file then rename. This is the simplest path and needs no networking entitlement. Sandboxed apps cannot use it, because the sandbox forbids writing outside their container, which is why the endpoint exists.

## Transport 2: the local endpoint

Command Center runs a small local server on the loopback interface, reachable only from the same machine. Any app that can open an outgoing connection to `127.0.0.1` can publish, including Mac App Store apps, which only need the common `com.apple.security.network.client` entitlement.

The endpoint speaks HTTP for registration and slow publishing, and a WebSocket for live, high-frequency publishing.

### Discovery

The provider needs to find the port.

1. Default port, documented in the SDK. Command Center listens there when free.
2. If the default is taken, Command Center advertises over Bonjour as `_commandcenter._tcp` on the local domain, and the SDK resolves it.

The SDK hides this. A provider calls `connect()` and does not think about ports.

### Registration and trust

Because any local process can reach the loopback endpoint, identity comes from explicit user consent, not from the network. The flow:

1. The provider calls `POST /v1/register` with its bundle id, display name, and manifest.
2. Command Center shows the user a prompt: this app wants to publish to your dashboard, with the app's name and, where it can be determined, its signing identity. Allow or deny.
3. On allow, Command Center returns a `providerToken`. The provider stores it, ideally in its Keychain, and sends it as a bearer token on every later call.
4. The user can revoke any provider at any time in the providers screen. A revoked token stops working immediately.

Registration is idempotent. A provider re-registering with the same bundle id refreshes its manifest and reuses or rotates its token.

### Identity notes

Loopback HTTP does not by itself prove which app is calling, so the consent token is the trust anchor. Where stronger proof is wanted, the endpoint can also be exposed as a Unix domain socket, which yields the peer process id and from it the code signing identity, at the cost of more sandbox path friction. The default is loopback TCP for the widest compatibility, with consent as the anchor. See [10-security.md](10-security.md).

### Publishing

Slow or occasional updates:

```http
POST /v1/publish
Authorization: Bearer <providerToken>
Content-Type: application/json

{ feed envelope from doc 03 }
```

Live updates, every half second or faster:

```text
WebSocket /v1/stream?token=<providerToken>
-> send one feed envelope per frame, carrying latest state
```

## Frequency and backpressure

Providers declare their cadence in the manifest:

```json
"publish": { "mode": "push", "minIntervalMs": 500 }
```

`mode` is `push` for live providers on the WebSocket, or `interval` for periodic file or POST updates. `minIntervalMs` tells the platform the fastest it should expect.

Command Center protects the render budget. It coalesces incoming updates and repaints on an animation frame, so a provider sending twice a second and a provider sending sixty times a second both stay smooth and neither starves the others. For glanceable widgets, providers should always send latest full state, not deltas, so a dropped frame never corrupts what is shown. The newest envelope always wins.

## The SDK

Publishing should be a few lines, so we ship `CommandCenterKit`, a small Swift package any developer adds. It hides transport choice, discovery, registration, token storage, atomic writes, and envelope construction.

```swift
import CommandCenterKit

let cc = CommandCenter(providerId: "com.acme.deploybot",
                       displayName: "DeployBot")

// One-time, prompts the user the first time.
try await cc.register(manifest: manifest)

// Slow path, file or POST chosen automatically by capability.
try await cc.publish(feed)

// Live path.
let stream = try await cc.openStream()
stream.send(feed)   // call as often as twice a second
```

The SDK picks the best transport available to the app. A Developer ID app with no network use can run purely on the file drop. A sandboxed app uses the endpoint. The developer writes the same code either way.

## Why not a cloud endpoint

A remote endpoint in the cloud would also accept data from anyone and sidestep sandbox and team limits. We do not use one for the first release, for two reasons. It would route private schedule and inbox data through a server, which the privacy stance in [10-security.md](10-security.md) avoids, and a half-second local update cadence does not belong on a network round trip. A cloud relay is a possible later option for syncing a glance across a person's own devices, and is out of scope for now.

## What this changes elsewhere

- Discovery in [03-provider-contract.md](03-provider-contract.md) spans two roots, the App Group container for the first-party suite and the well-known Application Support directory for the open platform. The discovery loop is otherwise unchanged.

Implementation status: the native side discovers providers across both roots (MultiRootFeedStore: App Group container plus the well-known Application Support directory, deduped by providerId with the App Group winning a collision). The feed envelope is validated; widget `data` is forwarded opaquely and validated by the dashboard. Transport 1 (the well-known directory, written by FileDropTransport) and Transport 2 (the loopback endpoint, IngestEndpoint + IngestHandler + the CommandCenterKit SDK) are both implemented; the providers consent screen (approve/deny/revoke) is the remaining open-platform UI.
- The trust model in [10-security.md](10-security.md) gains the registration consent flow and token revocation.
