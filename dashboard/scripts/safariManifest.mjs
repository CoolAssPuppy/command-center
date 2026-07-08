// Derive the Safari Web Extension manifest from the Chrome one, so there is a
// single source of truth (public/manifest.json) and the two never drift. Safari
// supports MV3, the CSP block, host permissions, and chrome_url_overrides
// unchanged; only three Chrome-specific things differ:
//
//   - "key" pins the Chrome extension id for the OAuth redirect. Safari derives
//     the id from the container app's bundle, so the field is meaningless and
//     the Web Extension validator rejects it.
//   - the "identity" permission backs chrome.identity, which Safari does not
//     implement. Google sign-in on Safari goes through the native container app
//     instead, so the permission is dropped.
//   - "nativeMessaging" is added so the new tab page can reach that container
//     app's SafariWebExtensionHandler.

/**
 * @param {Record<string, unknown>} chromeManifest The parsed Chrome manifest.
 * @returns {Record<string, unknown>} A new Safari manifest; the input is untouched.
 */
export function toSafariManifest(chromeManifest) {
  const { key, permissions, ...rest } = chromeManifest;
  void key; // dropped: Safari derives the extension id from the app bundle.

  const base = Array.isArray(permissions) ? permissions : [];
  const safariPermissions = base.filter((permission) => permission !== "identity");
  if (!safariPermissions.includes("nativeMessaging")) {
    safariPermissions.push("nativeMessaging");
  }

  return { ...rest, permissions: safariPermissions };
}
