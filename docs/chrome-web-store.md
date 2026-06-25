# Submitting Command Center to the Chrome Web Store

This is the step-by-step guide for publishing the extension. For building and
running it unpacked, see `packaging.md`. All commands run from `dashboard/`.

## 1. One-time setup

Register a developer account at the
[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
There is a one-time $5 registration fee.

## 2. Build the upload package

```bash
cd dashboard
pnpm package      # build:extension, then zip dist-extension into command-center.zip
```

Upload `command-center.zip`. It is a Manifest V3 extension with the name,
description, and 16/48/128 icons already set.

## 3. The extension ID and OAuth (read this first)

Google sign-in depends on the extension ID. Locally, the manifest `key` pins the
ID to `biamcfihjdgcgokoimebcijddccfmdbe`, and the OAuth redirect is
`https://biamcfihjdgcgokoimebcijddccfmdbe.chromiumapp.org/`. When you publish,
the Web Store assigns its own ID, which differs unless you sync the key. So:

1. Create the item and upload once to get the **published extension ID** (shown
   in the dashboard, along with the item's public key).
2. Set the manifest `key` to that item's public key so local development and
   production share one ID, then rebuild and reupload.
3. In Google Cloud Console, add `https://<published-id>.chromiumapp.org/` as an
   authorized redirect URI on the Web OAuth client.

Skip this and Google sign-in works in development but breaks for installed users.

## 4. Store listing assets

- A **128x128 icon** (already in the package).
- At least one **screenshot**, 1280x800 or 640x400.
- A description, a category (Productivity), and a language.
- A **privacy policy URL** (required, see section 6).
- Optionally a 440x280 promo tile.

Note: a new-tab override extension gets extra review scrutiny, so the listing
should make clear it is a personal dashboard.

## 5. Permission justifications

The review asks why each permission is needed. Suggested wording:

- **storage**: Saves the user's own settings (zones, cards, themes) on their
  device and in their Chrome sync.
- **identity**: Used only for the user to sign in to their own Google account so
  the extension can read their calendars and tasks.
- **Host permissions** (the API and feed hosts): The extension fetches data only
  from the services the user connects, each over HTTPS:
  - `googleapis.com` for the user's Google Calendar and Tasks
  - `api.notion.com`, `api.linear.app`, `api.github.com`, `api.todoist.com` for
    the user's notes, issues, pull requests, and tasks
  - `finnhub.io` for stock quotes, `api.frankfurter.dev` for currency rates
  - `hacker-news.firebaseio.com` and the news RSS hosts (The Verge, TechCrunch,
    Ars Technica, BBC, NYT, NPR, Techmeme) for the news ticker
  - `api.open-meteo.com` and `geocoding-api.open-meteo.com` for weather
  - `api.unsplash.com` / `images.unsplash.com` for optional wallpaper photos
  - `google.com/s2/favicons` for the small source and link icons

Keep a **single-purpose** statement: a calm new-tab dashboard that shows the
user's own clocks, weather, work items, and chosen feeds.

## 6. Privacy policy

A privacy policy URL is required because the extension handles user data
(OAuth tokens and the content of calendars, tasks, issues, and pull requests).
Host the text below somewhere public (a GitHub Pages page or a gist works) and
paste its URL into the dashboard's Privacy practices tab.

> **Command Center privacy policy**
>
> Command Center runs entirely in your browser. Your settings are stored with
> Chrome's storage on your device and your Chrome sync. Your API tokens and
> Google sign-in tokens are stored locally on your device and are never synced.
>
> The extension talks only to the services you connect (Google, Notion, Linear,
> GitHub, Todoist, Finnhub, weather, and the news feeds you choose), and only to
> show that data to you on your new tab. It sends your data to no one else. There
> is no analytics, tracking, or developer-operated server, and the developer
> cannot see any of your data.
>
> Remove a connection at any time in the customize pane to delete its stored
> credential. Uninstalling the extension removes all stored data.

Adjust to match your hosting and contact details before publishing.

## 7. Google OAuth verification

The Google scopes are `calendar.readonly` and `tasks.readonly`, which Google
treats as **sensitive**.

- For **personal use**, keep the OAuth app in testing mode and add your own
  accounts as test users. No verification is needed.
- To let the **public** connect their Google accounts, the OAuth consent screen
  must pass **Google's verification** (a brand and scope review that can take
  days to weeks). If you would rather not wait, publish the extension as
  **Unlisted** and keep the OAuth app in testing.

## 8. Submit

Upload the package, fill in the listing, privacy practices, and permission
justifications, choose visibility (Public, Unlisted, or Private), and submit for
review. Review usually takes from a few hours to a few days.

## 9. After it is approved

- Confirm the manifest `key` matches the published item so the ID is stable.
- Confirm `https://<published-id>.chromiumapp.org/` is registered on the OAuth
  client, then test Google sign-in on the installed version.
- For later updates: bump `version` in the manifest, run `pnpm package`, and
  upload the new zip.
