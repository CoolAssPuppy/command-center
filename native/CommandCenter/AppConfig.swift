import CommandCenterAuth
import Foundation

/// The app's compile-time OAuth client. Safari sign-in needs a Google "Desktop
/// app" OAuth client (distinct from the Chrome build's Web client), because only
/// a desktop client allows the custom-scheme / loopback redirect that
/// ASWebAuthenticationSession uses. The client id is not a secret and ships in
/// the app; a desktop client has no usable secret and relies on PKCE.
///
/// Google's convention for a desktop client's custom-scheme redirect is the
/// reversed client id, which becomes the ASWebAuthenticationSession callback
/// scheme below. The id is the Doppler `GOOGLE_OAUTH_CLIENT_ID` for the
/// command-center project (the Safari Desktop client, distinct from the Chrome
/// web client). It is not a secret, so it lives in source like the dashboard's
/// own client id. See docs/safari-release-setup.md.
enum AppConfig {
    static let googleClientID =
        "180895780616-8bkq115onih2tu3020go6c03vj42jpbb.apps.googleusercontent.com"

    static var googleOAuth: OAuthConfig {
        OAuthConfig(
            clientID: googleClientID,
            redirectURI: "\(reversedClientID(googleClientID)):/oauth2redirect"
        )
    }

    /// com.googleusercontent.apps.<id> — the reverse-DNS scheme Google issues for
    /// a desktop client, used as the ASWebAuthenticationSession callback scheme.
    private static func reversedClientID(_ clientID: String) -> String {
        let base = clientID.replacingOccurrences(of: ".apps.googleusercontent.com", with: "")
        return "com.googleusercontent.apps.\(base)"
    }
}
