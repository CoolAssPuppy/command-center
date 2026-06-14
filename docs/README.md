# Command Center

A platform for glanceable information in the browser. Command Center replaces the new tab and new window with a live, gorgeous view of the things you want to know the second you sit down: today's schedule, one-click meeting links, world clocks, weather, and signal from any app you run.

It is open on two sides. Any macOS app, App Store or Developer ID, can publish to it by sending data to its endpoint in a published protocol. The app keeps its own OAuth and tokens and just publishes finished, glanceable information. And the presentation layer is pluggable too: Command Center ships a few beautiful themes and lets others build more. Providers declare what to show, themes decide how it looks.

Start with [00-vision.md](00-vision.md) for the why and the shape of the platform.

## How to read these docs

Read them in order if you are building from scratch. Each file is self-contained enough to use as a reference later.

| File | What it covers |
| --- | --- |
| [00-vision.md](00-vision.md) | The platform thesis: the surface, the glance, the three layers |
| [01-overview.md](01-overview.md) | Goals, non-goals, glossary |
| [02-architecture.md](02-architecture.md) | Components, data flow, and why the provider-feed model |
| [03-provider-contract.md](03-provider-contract.md) | The App Group container, manifest, feed lifecycle, discovery, versioning |
| [04-feed-schemas.md](04-feed-schemas.md) | Concrete JSON schemas for every feed kind |
| [05-native-app.md](05-native-app.md) | The Command Center macOS app: reader, link opener, settings, URL scheme |
| [06-safari-extension.md](06-safari-extension.md) | Manifest V3, new tab override, native messaging bridge |
| [07-dashboard-ui.md](07-dashboard-ui.md) | The web dashboard: widgets, time zones, weather, states |
| [08-settings-sync.md](08-settings-sync.md) | iCloud key-value sync and look-and-feel tokens |
| [09-satellite-integration.md](09-satellite-integration.md) | Exact changes to make Linear Bar and Meeting Notifier publish feeds |
| [10-security.md](10-security.md) | Token ownership, secrets, sandbox, entitlements, threat model |
| [11-roadmap.md](11-roadmap.md) | Phased MVP plan, milestones, risks, open questions |
| [12-transports-and-ingest.md](12-transports-and-ingest.md) | How any app plugs in: file drop, the local endpoint, the SDK |
| [13-representation-model.md](13-representation-model.md) | The widget vocabulary providers declare and themes render |
| [14-themes.md](14-themes.md) | Pluggable themes: tiers, tokens, render API, trust, shipped themes |
| [15-building-a-provider.md](15-building-a-provider.md) | Third-party guide: publish to Command Center with CommandCenterKit (see `examples/sample-provider`) |

## The one-paragraph version

The Safari extension overrides the new tab page with a live web dashboard. A small macOS app owns settings, opens meeting links in the browser you choose, registers a URL scheme for one-click actions, and runs a local ingest endpoint. Any app can publish to that endpoint, or drop a file for the simple case, in a published protocol: data plus a chosen representation from a fixed widget vocabulary. Each app keeps owning its own OAuth tokens and refresh logic, so no credentials ever cross a boundary. Themes, shipped and third-party, paint those widgets. Settings and look-and-feel sync across your Macs through iCloud.

Strategic Nerds' own apps may take a shortcut and share an App Group container instead of the endpoint. That is an optimization, not the platform. The platform is the endpoint, the protocol, and the themes.

## Identifiers used throughout

These are the canonical identifiers the spec assumes. Change them in one place if you rename anything.

- App Group: `group.com.strategicnerds.suite`
- Command Center app bundle id: `com.strategicnerds.commandcenter`
- Safari extension bundle id: `com.strategicnerds.commandcenter.Extension`
- Command Center URL scheme: `commandcenter://`
- iCloud key-value store id: `$(TeamIdentifierPrefix)com.strategicnerds.commandcenter`

Apple Team prefix is shared across all Strategic Nerds apps, which is what makes the App Group and any cross-app sharing legal.
