# Submitting Command Center to the Chrome Web Store

The step-by-step guide for publishing, plus every listing field ready to copy and
paste. For building and running unpacked, see `packaging.md`. Commands run from
`dashboard/`.

## 1. One-time setup

Register a developer account at the
[Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
There is a one-time $5 registration fee.

## 2. Build the upload package

```bash
cd dashboard
pnpm package      # build:extension, then write command-center.zip for the store
```

Upload `command-center.zip`. The Web Store rejects a manifest that contains a
`key` field, so `pnpm package` strips `key` from the zip automatically while
leaving it in your local dev build (see section 3).

## 3. Extension ID and OAuth (read this first)

Google sign-in depends on the extension ID. Locally, the `key` in
`public/manifest.json` pins the ID to `biamcfihjdgcgokoimebcijddccfmdbe`, and the
OAuth redirect is `https://biamcfihjdgcgokoimebcijddccfmdbe.chromiumapp.org/`. The
Web Store does not allow `key` in an uploaded manifest and assigns its own ID, so:

1. Upload the key-stripped zip once to get the **published extension ID** (shown
   in the dashboard, with the item's public key).
2. In Google Cloud Console, add `https://<published-id>.chromiumapp.org/` as an
   authorized redirect URI on the same OAuth client. This is a config change on
   the existing client, not a new app, and needs no re-approval.
3. To make local development share the published ID, set the `key` in
   `public/manifest.json` to the published item's public key. It stays only in
   your local build; `pnpm package` keeps stripping it from uploads.

## 4. Listing text (copy and paste)

Item name (max 75 characters):

```
Command Center: a calm new tab dashboard
```

Summary, the short description (max 132 characters):

```
A calm new tab: clocks, weather, your tasks, pull requests, and Linear, plus stock and news tickers. Your data stays on device.
```

Detailed description:

```
Command Center turns your new tab into a calm home base. Open a tab and you see what matters, and nothing you do not.

See the time where you are and wherever your people are, with the overlap window that shows when they are awake. Today's weather and the days ahead sit beside it.

A "Needs you" lane gathers whatever is actually waiting on you: your next meeting, ready to join in one click; pull requests that need your review; your Linear inbox; your tasks. Everything else you care about sits alongside, arranged however suits you.

Bring in only the services you use, each with your own account:
- Google Calendar and Google Tasks
- Notion
- Linear: assigned work, issues you created, what is due soon, your inbox, projects, and initiatives
- GitHub pull requests and issues
- Todoist

Keep a quiet eye on the markets and the day's headlines with optional tickers along the top, from the sources you choose.

Make it yours. Ten themes, from a stark black-and-white to a warm candlelit dark, all easy on the eyes, with your own wallpaper and themes you can design and share.

And it stays yours. Everything lives in your browser. Your settings follow you through Chrome; your accounts never leave your device. No tracking, no analytics, no server in the middle. Command Center talks only to the services you connect, and only ever to show you your own day.
```

Category:

```
Productivity
```

Language:

```
English (United States)
```

Single purpose (Privacy practices tab):

```
Command Center replaces the new tab page with a personal dashboard that shows the user's own clocks, weather, work items, and chosen feeds.
```

## 5. Permission justifications (copy and paste)

storage:

```
Stores the user's own settings: time zones, data cards, themes, and ticker choices. Kept on the device and in the user's Chrome sync. No other data is stored.
```

identity:

```
Lets the user sign in to their own Google account through chrome.identity so the extension can read that account's Google Calendar and Google Tasks. It is used for nothing else.
```

Host permissions:

```
The extension fetches data only from the services the user connects, each over HTTPS, and only to show it on the new tab:
- googleapis.com: the user's Google Calendar and Google Tasks
- api.notion.com, api.linear.app, api.github.com, api.todoist.com: the user's notes, issues, pull requests, and tasks
- finnhub.io and api.frankfurter.dev: stock quotes and currency rates
- hacker-news.firebaseio.com and the chosen news feeds (theverge.com, techcrunch.com, arstechnica.com, bbc.co.uk, nytimes.com, npr.org, techmeme.com): the news ticker
- api.open-meteo.com and geocoding-api.open-meteo.com: weather
- api.unsplash.com and images.unsplash.com: optional wallpaper photos
- google.com/s2/favicons: small source and link icons
No data is sent anywhere else.
```

Remote code: answer No. The extension runs only the code in the package and does
not load or execute remote code.

## 6. Privacy policy (host this text, then paste its URL)

Host the text below at a public URL (a GitHub Pages page or a gist works) and
paste that URL into the Privacy practices tab. Adjust the contact line first.

```
Command Center privacy policy

Command Center runs entirely in your browser. Your settings are stored with Chrome's storage on your device and your Chrome sync. Your API tokens and Google sign-in tokens are stored locally on your device and are never synced.

The extension talks only to the services you connect (Google, Notion, Linear, GitHub, Todoist, Finnhub, weather, and the news feeds you choose), and only to show that data to you on your new tab. It sends your data to no one else. There is no analytics, tracking, or developer-operated server, and the developer cannot see any of your data.

Remove a connection at any time in the customize pane to delete its stored credential. Uninstalling the extension removes all stored data.

Questions: <your contact email>
```

## 7. Data use declarations

In the Privacy practices tab, declare that Command Center does not collect or
transmit user data to the developer or any third party. All data stays on the
user's device or moves directly between the user's browser and the services they
connect. If the form makes you pick a handled data type, the one that applies is
Authentication information (the user's API and OAuth tokens), stored locally and
never sent to the developer. Then check the three required certifications:

- I do not sell user data.
- I do not use or transfer user data for purposes unrelated to the single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending.

## 8. Visual assets

- A 128x128 icon (already in the package).
- At least one screenshot, 1280x800 or 640x400.
- Optionally a 440x280 promo tile.

A new-tab override extension gets extra review scrutiny, so the screenshots and
description should make clear it is a personal dashboard.

## 9. Google OAuth verification

The Google scopes are `calendar.readonly` and `tasks.readonly`, which Google
treats as sensitive.

- For an Internal (Google Workspace) app approved by your admin, no public
  verification is needed; only accounts in your org can sign in.
- For personal use, keep the OAuth app in testing mode with your accounts as test
  users.
- To let the general public connect any Google account, the consent screen must
  pass Google's verification, which can take days to weeks.

Adding the published extension's redirect URI to the same OAuth client does not
change which app is approved and does not trigger re-approval.

## 10. Submit

Upload the package, fill in the listing, privacy practices, and permission
justifications, choose visibility (Public, Unlisted, or Private), and submit for
review. Review usually takes from a few hours to a few days.

## 11. After it is approved

- Set the `key` in `public/manifest.json` to the published item's public key so
  local development shares the published ID (the upload stays key-free).
- Confirm `https://<published-id>.chromiumapp.org/` is registered on the OAuth
  client, then test Google sign-in on the installed version.
- For later updates: bump `version` in the manifest, run `pnpm package`, and
  upload the new zip.
```
