# Command Center

## Register

product (the design serves a personal tool, it is not the product itself)

## What it is

A Chrome MV3 new-tab override. Every time a new tab opens, this full-viewport
page replaces it: a personal command center for someone who lives across
timezones and a handful of work tools. It runs serverless, from the extension
origin, with config in `chrome.storage.sync` and secrets in
`chrome.storage.local`.

## Users

One primary user: a developer and founder who opens dozens of new tabs a day.
He works with collaborators in other timezones, jumps between Linear, Notion,
and Google Calendar, and keeps a short set of links he hits constantly. He is
technical, opinionated about craft, and will notice a misaligned pixel or a
limp empty state immediately. The interface is glanced at, not studied: it has
to answer "what time is it for them, what is on my plate, where do I go" in
under a second.

## Purpose

- See the home time, a greeting, and the current moment at a glance.
- Read other timezones and the overlap window where a meeting actually fits.
- Reach a small dock of frequent links without thinking.
- Skim work streams (calendar events, Linear issues, Notion rows) pulled from
  named connections, without leaving the tab.
- Customize all of it in a slide-in drawer, live, no save button ceremony.

## Tone and brand

Calm, precise, quiet confidence. This is an instrument panel, not a dashboard
product trying to sell itself. It should feel like a well-made watch face:
legible, restrained, a little warm. Personality lives in the themes and the
typography, never in chrome or decoration. No marketing voice anywhere in the
UI; microcopy is plain and direct.

## Anti-references

- Generic SaaS dashboards: hero metric cards, gradient accents, icon-heading-
  text card grids repeated down the page.
- Startpage / new-tab products drowning in widgets, weather, news, and ads.
- Glassmorphism and neon-on-black "developer tool" clichés.
- Anything that reads as "AI generated this in one shot."

## Strategic principles

1. Glanceability over density. If it cannot be read in a second, it is noise.
2. The data is the interface. Brand marks, times, and titles carry the design;
   containers recede.
3. Live customization. Editing applies instantly to the surface behind the
   drawer.
4. Themes are the personality budget. The layout stays disciplined; the palette
   carries the mood, and switches day to night on its own.
