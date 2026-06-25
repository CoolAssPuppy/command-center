/**
 * The Google OAuth 2.0 client ID for multi-account calendar sign-in.
 *
 * Sign-in uses chrome.identity.launchWebAuthFlow, which shows Google's account
 * chooser, so each calendar connection can be a different account. That flow
 * needs a "Web application" OAuth client (the old Chrome-app client used by
 * getAuthToken does not work here). To set it up, in Google Cloud Console:
 *
 *   1. Create an OAuth 2.0 Client ID of type "Web application".
 *   2. Add this authorized redirect URI exactly (your extension's id is fixed
 *      by the manifest key):
 *        https://biamcfihjdgcgokoimebcijddccfmdbe.chromiumapp.org/
 *   3. On the OAuth consent screen, publish the app or add every Google account
 *      you want to connect as a test user (testing mode only lets listed
 *      accounts consent).
 *   4. Paste the client id below.
 *
 * While this is empty, Google sign-in is treated as unconfigured and the
 * connection row shows a hint instead of a connect button. The client id is not
 * a secret; it ships in the extension.
 */
export const GOOGLE_OAUTH_CLIENT_ID =
  "180895780616-j3anr6pel0kmubkqu095rb857nuhehsf.apps.googleusercontent.com";

/** OAuth scopes requested: read-only calendar, plus the account's email. */
export const GOOGLE_OAUTH_SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.readonly",
] as const;
