# Vision

Command Center is not an app. It is a platform for glanceable information in the browser.

## The surface

Every day, a knowledge worker opens dozens of new tabs and new windows. That first screen, before they type anything, is the highest-frequency and lowest-intent moment in their whole day. Today it shows Favorites. That is wasted attention on the most valuable real estate a browser has.

Command Center owns that surface. It replaces the new tab and new window with a live, gorgeous view of the things a person wants to know the second they sit down.

## The glance

The unit of value is the glance. Information a person absorbs in about a second, without navigating anywhere and often without acting. The next meeting. An unread count. A build status. The top of an inbox. A line on a chart that moved.

A glance is not an app embedded in a tab. It is a summary, chosen and shaped for instant reading. Everything in the platform serves the glance.

## A two-sided platform

There are two sides, and Command Center sits between them.

- People want their world summarized on that surface, in a layout and style they love.
- Developers want their app's signal present where attention already lands, without building and maintaining a browser surface themselves.

Command Center owns the surface and the protocol. Developers supply signal. The value compounds as more apps publish, because each new provider makes the surface worth more to the person looking at it. The moat is not any single widget. It is the surface, the protocol, and the set of apps and themes that show up.

## Three layers

The architecture separates three jobs so each can have its own open community of contributors.

```text
+-----------------------------------------------------------+
|  Themes            paint pixels                           |
|  take semantic widgets and render them, with tokens,      |
|  motion, charts, backgrounds. Ship 2 to 3, allow more.    |
+-----------------------------------------------------------+
|  Command Center core    owns the contract                 |
|  ingest endpoint, provider trust, attention and layout,   |
|  and the guaranteed widget vocabulary every theme paints. |
+-----------------------------------------------------------+
|  Providers          declare intent                        |
|  any macOS app, App Store or Developer ID, publishes data |
|  plus a chosen representation. Owns its own OAuth and      |
|  tokens. Never paints pixels.                             |
+-----------------------------------------------------------+
```

The rule that holds it together: providers declare, themes render, and neither does the other's job. A provider chooses a representation from a fixed vocabulary, a metric or a table or a chart, and binds data to it. A theme decides how that metric or table or chart looks. The core guarantees that every widget in the vocabulary can be rendered by every theme.

## Open on both sides

The platform is open to two kinds of contributor.

- Provider developers. Any macOS app can plug in. Mac App Store apps and side-loaded Developer ID apps both work. The promise is simple: send data to the Command Center endpoint in the published protocol, and you are in. The app keeps its own relationship with OAuth, tokens, refresh, and its backend. It just publishes finished, glanceable information. An app can publish twice a second or once a day, whatever fits its data. See [12-transports-and-ingest.md](12-transports-and-ingest.md).
- Theme developers. The presentation layer is pluggable too. We ship two to three beautiful themes and publish a guideline so others can build more. A theme can be as light as a set of color and type tokens, or as ambitious as a custom renderer with charts, motion, and a living background. See [14-themes.md](14-themes.md).

## What we publish and what others supply

We supply the surface, the protocol, the trust and attention model, an SDK that makes publishing a few lines of code, and a small number of stunning default themes. Other developers supply providers and, over time, themes. The representation vocabulary is the shared language both sides speak. See [13-representation-model.md](13-representation-model.md).

## Principles

1. The glance is the unit. If something cannot be understood in about a second, it does not belong on the surface, it belongs behind a click.
2. Providers declare, themes render. No provider ships pixels. No theme owns data.
3. Own your own tokens. Each provider keeps its credentials. The platform never holds them and never needs them.
4. Any app, any store. Mac App Store and Developer ID are equal citizens. The endpoint is the universal door.
5. Beautiful by default. The shipped themes set a high bar so the platform feels finished on first run.
6. Attention is scarce. With many providers, the platform decides what earns a glance and what earns a click. That is a core job, not an afterthought.
7. The surface is plural. The new tab is the first surface. The protocol assumes there will be more.

## How the rest of the spec relates

The earlier documents describe a first-party fast path, where Strategic Nerds apps share an App Group container. That remains a convenient internal shortcut. This document, and documents 12 through 14, describe the open platform that any developer can join. Where they differ, the open platform is the real product and the App Group is an optimization for apps that happen to share a team.
