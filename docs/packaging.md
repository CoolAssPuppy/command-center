# Packaging and shipping Command Center

Command Center is a Chrome Manifest V3 extension that overrides the new tab page.
This guide covers two ways to ship it:

- **A. Run it yourself, no Web Store** (load unpacked, with Google Calendar
  working). Best for personal use.
- **B. Publish to the Chrome Web Store** (so others can install it).

Both need Google OAuth set up if you want Google Calendar. Notion, Linear, the
clocks, the dock, and the wallpaper need no OAuth at all (personal keys, stored
locally), so if you drop Calendar you can skip every Google step.

All commands run from the `dashboard/` directory and assume pnpm.

## What the build produces

```bash
cd dashboard
pnpm run build:extension   # -> dashboard/dist-extension/  (loadable unpacked)
pnpm run package           # -> dashboard/command-center.zip (for the Web Store)
```

`dist-extension/` contains `manifest.json`, `newtab.html`, the JS/CSS bundle, and
the icons. That folder is the whole extension.

## The one hard part: a stable extension ID

Google ties OAuth to a fixed extension ID, so the ID must not change between your
machine and production. The ID is derived from a public key in the manifest. Pin
it once and reuse it everywhere.

### Generate a key and ID locally (no Web Store needed)

```bash
# A private key (keep this file OUT of git; you only need it to pack a .crx)
openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out command-center.pem

# The manifest "key" value (public key, base64 DER) — safe to commit
openssl rsa -in command-center.pem -pubout -outform DER 2>/dev/null | base64 | tr -d '\n'; echo

# The extension ID derived from that key
openssl rsa -in command-center.pem -pubout -outform DER 2>/dev/null \
  | openssl dgst -sha256 -binary \
  | xxd -p | tr -d '\n' | head -c 32 | tr '0-9a-f' 'a-p'; echo
```

Add the public key to `dashboard/public/manifest.json`:

```json
{
  "manifest_version": 3,
  "key": "MIIBIjANBgkqhki...the base64 string from above...",
  ...
}
```

Rebuild and load unpacked: the extension now has the derived, stable ID on any
machine. Note that ID for the OAuth step.

(If you publish to the store instead, the store assigns the ID and shows you the
matching public key to paste into `key`. Either source works; pick one.)

## Google OAuth (only if you keep Calendar)

1. **console.cloud.google.com** -> create a project.
2. **APIs & Services -> Library** -> enable **Google Calendar API**.
3. **APIs & Services -> OAuth consent screen**:
   - User type **External**.
   - App name, support email, developer email.
   - **Scopes** -> add `.../auth/calendar.readonly`.
   - **Test users** -> add your own Google address.
   - Leave **Publishing status: Testing** for personal use. (Switch to In
     production and submit for verification only when strangers need it.)
4. **APIs & Services -> Credentials -> Create credentials -> OAuth client ID**:
   - Application type **Chrome Extension**.
   - **Item ID**: the extension ID from the step above.
   - Copy the **Client ID** (ends in `.apps.googleusercontent.com`). There is no
     client secret, which is why this is safe in client-side code.
5. Put it in `dashboard/public/manifest.json`, replacing the placeholder:

```json
"oauth2": {
  "client_id": "YOUR-ID.apps.googleusercontent.com",
  "scopes": ["https://www.googleapis.com/auth/calendar.readonly"]
}
```

6. Rebuild. In the extension, add a Google Calendar connection in Customize and
   click **Connect Google** on its row. That button is the sign-in: it calls
   `chrome.identity.getAuthToken`, which shows Google's own account picker and
   consent. No separate "Sign in with Google" button is needed.

In Testing mode the granted token is refreshed for ~7 days at a time; you re-
consent occasionally. Publishing the OAuth app (verification) removes that.

## A. Run it yourself, no Web Store

1. Pin the extension ID with a `key` (above).
2. Set up OAuth (above) if you want Calendar.
3. Build: `pnpm run build:extension`.
4. Chrome -> `chrome://extensions` -> enable **Developer mode** -> **Load
   unpacked** -> select `dashboard/dist-extension`.
5. Open a new tab. Calendar, Notion, and Linear all work here, because the
   extension has real `host_permissions` and `chrome.identity`.

This is permanent for you. To update, rebuild and click the reload icon on the
extension card. Keep the same `dist-extension` path so the ID stays put.

Sharing with other people this way is awkward: Chrome blocks manually installed
`.crx` files unless they come from the store (or enterprise policy). For other
users, use the Web Store (an Unlisted listing still requires the store but hides
it from search).

## B. Publish to the Chrome Web Store

1. **chrome.google.com/webstore/devconsole** -> register (one-time $5 fee).
2. **New item** -> upload `command-center.zip`.
3. Listing: name, summary, description, category (Productivity), at least one
   1280x800 screenshot, the 128x128 icon (already bundled).
4. **Privacy practices**: declare no server-side collection, justify each
   permission (`storage` saves settings/keys locally; `identity` is Google
   sign-in; the host permissions are the services you connect), and add a
   **privacy policy URL**.
5. **Distribution**: **Unlisted** (link-only, good for personal/small) or
   **Public**.
6. **Submit for review.** New-tab overrides get extra scrutiny; expect a few
   days. They email you if anything needs fixing.

### Privacy policy

The store and the OAuth consent screen both require one. It can be a single page
anywhere (GitHub Pages, a public Notion page, a gist). It should state: settings
and credentials are stored locally in the browser via `chrome.storage`; nothing
is sent to any server the developer runs; calls go only to the services the user
connects (Google, Notion, Linear, Unsplash, Open-Meteo).

## Updating

Bump `version` in `dashboard/public/manifest.json` (the store rejects re-uploads
with the same version), then `pnpm run package` and upload the new zip to the
same item. For the unpacked install, just rebuild and reload.
