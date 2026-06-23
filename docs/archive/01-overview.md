# Overview

## What we are building

Command Center replaces the page you see when you open a new Safari tab or start Safari fresh. Instead of Favorites, you get a personal dashboard built for the start of a work session.

The dashboard shows:

- Today's schedule, pulled from calendar providers you have connected.
- A Join button on every event that has a detected meeting link, which opens in the browser you choose.
- The current local time and date.
- A multi-city time zone viewer with day and night state and a visual timeline.
- Weather for a city you pick.
- Feeds from other apps you already run, such as your Linear inbox.
- Optional reminders and tasks.

## The platform idea

Two of your existing apps already do most of the hard parts:

- Meeting Notifier (`com.strategicnerds.meetingnotifier`) connects Google and Microsoft calendars over OAuth, reads events, detects conference links, and opens them in the browser you choose. It owns those tokens in the Keychain.
- Linear Bar (`com.strategicnerds.LinearBarApp`) connects Linear over OAuth and reads your inbox. It owns those tokens in the Keychain.

Rather than re-implement all of that OAuth inside Command Center, we let those apps contribute. When a user has one of them installed, it publishes a small data feed into a shared container. Command Center detects the feed and renders it. The result feels like the user's existing accounts "slot in" automatically.

The apps keep owning their tokens. Command Center never sees a single credential. This is a deliberate design choice, explained in [02-architecture.md](02-architecture.md) and [10-security.md](10-security.md).

## Goals

1. Replace the Safari new tab page with a fast, beautiful dashboard.
2. Show today's schedule and one-click meeting joins.
3. Provide a multi-city time zone viewer and a weather widget that need no native permissions.
4. Let installed companion apps contribute feeds with no extra sign-in.
5. Sync settings and look-and-feel across the user's Macs through iCloud.
6. Degrade gracefully. If a provider is missing, hide its card. If a feed is stale, say so.

## Non-goals for the first release

- Reading Apple Notes. There is no supported public API for it. Out of scope.
- A mobile or iOS version. Mac only.
- Account sync of OAuth tokens across machines. Each Mac authorizes its own providers. Settings sync, tokens do not.
- A hosted backend for the dashboard itself. The dashboard is static and bundled in the extension. A tiny token-exchange proxy may exist inside a satellite app, but it is not part of Command Center.

## Why the dashboard is built static-first

The fastest way to make this real is to build the dashboard as a standalone static web app against mock feed data, see it, and iterate on the look. Only then do we wrap it in the Safari extension and wire the native bridge. The build plan in [11-roadmap.md](11-roadmap.md) follows that order.

## Glossary

- Dashboard: the static web app that renders the new tab page.
- Extension: the Safari Web Extension that overrides the new tab page and hosts the native bridge.
- Command Center app: the native macOS app that owns settings, opens links, and registers the URL scheme.
- Satellite app: an existing app, such as Linear Bar or Meeting Notifier, that publishes a feed.
- Provider: a satellite app's contribution, described by a manifest and one or more feeds.
- Feed: a single versioned JSON file describing one kind of data, for example today's events.
- Manifest: a JSON file that describes a provider, its feeds, and its actions.
- App Group container: the shared on-disk folder that all of these apps can read and write.
