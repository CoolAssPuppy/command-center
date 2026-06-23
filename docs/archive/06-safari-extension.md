# Safari extension

The extension does one thing that matters: it overrides the new tab page with the dashboard. Everything else is plumbing to feed the dashboard.

## New tab override

Safari Web Extensions support the standard `chrome_url_overrides` key. This was the open question in early planning, and it is confirmed working against Apple's developer forums. Manifest V3:

```json
{
  "manifest_version": 3,
  "name": "Command Center",
  "version": "1.0",
  "default_locale": "en",
  "chrome_url_overrides": {
    "newtab": "newtab.html"
  },
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "permissions": ["nativeMessaging"],
  "icons": { "128": "images/icon-128.png" }
}
```

`newtab.html` is the dashboard entry point, bundled in the extension. When the user opens a new tab, Safari loads it.

### The known startup caveat

There is one documented Safari bug. When Safari is fully quit and reopened after the extension is installed, Safari can log a false error: "The service_worker script failed to load due to an error." It does not happen when Safari is already open at install time, and the override still loads. Apple acknowledged it and asked for Feedback Assistant reports.

Mitigations:

- Keep `background.js` tiny and side-effect-free at top level. Do the real work inside event handlers, not during module evaluation. A heavy service worker makes the false error more likely to bite.
- The dashboard must not depend on the service worker being alive. It talks to the native handler directly with `sendNativeMessage`, which works regardless of service worker state.
- Test the cold-start path explicitly on the target Safari version. Quit Safari, reopen, open a new tab, confirm the dashboard renders.

## Files

```text
CommandCenterExtension/
  Resources/
    manifest.json
    newtab.html
    background.js          # minimal
    assets/                # built dashboard: css, js, fonts, city table
  SafariWebExtensionHandler.swift   # native bridge, reads App Group
```

The dashboard is built as static assets and copied into `Resources/assets/` at build time. See [07-dashboard-ui.md](07-dashboard-ui.md) for how it is built.

## Native messaging

The dashboard fetches its data in one call:

```js
async function loadDashboard() {
  try {
    return await browser.runtime.sendNativeMessage("application.id", { type: "getDashboard" });
  } catch (e) {
    return { error: "native_unreachable" };
  }
}
```

`sendNativeMessage` reaches the `SafariWebExtensionHandler` in the extension's app extension process, which reads the App Group container and returns providers plus settings. There is no separate native messaging host process to install, unlike Chrome. The handler is part of the extension target.

If the call fails, the dashboard still renders the widgets it can compute on its own, time and time zones, and shows a quiet "Open Command Center to connect your data" prompt for the rest.

## Background script scope

`background.js` stays minimal. Its only real job is optional: listen for a `feeds-changed` signal if we later add push refresh. For the MVP it can be close to empty. Do not put data fetching, parsing, or polling loops at module top level, to avoid aggravating the startup caveat.

## Permissions

The extension requests only `nativeMessaging`. It does not need host permissions, because the dashboard is its own bundled page and does not inject scripts into other sites. Weather and any other outbound fetch the dashboard makes go to allowlisted hosts and are subject to the page's content security policy, set in `newtab.html`.

## Content security policy

`newtab.html` ships a strict CSP. Allow only self for scripts and styles, and the weather host for connect. Example:

```html
<meta http-equiv="Content-Security-Policy"
  content="default-src 'self'; connect-src 'self' https://api.open-meteo.com; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'">
```

`img-src https:` is permitted so provider avatars, for example Linear actor avatars, can load. Tighten if avatars are proxied through the native layer later.

## Distribution note

A Safari Web Extension must be delivered inside a containing app, which is the Command Center app. Whether shipped through the Mac App Store or Developer ID, the extension turns on in Safari Settings, Extensions. The onboarding in the app should walk the user to that toggle the first time.
