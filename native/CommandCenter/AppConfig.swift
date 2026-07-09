import CommandCenterAuth
import Foundation

/// The app's compile-time OAuth client. Safari sign-in needs a Google **iOS**
/// OAuth client, which is the only type that allows the reversed-client-id custom
/// scheme redirect. ASWebAuthenticationSession can only capture a custom scheme,
/// never an http:// loopback, so a Desktop client would force the flow out into
/// the system browser. A Web client (what the Chrome build uses) rejects custom
/// schemes outright, and a Chrome-app client fails with
/// "Custom URI scheme is not supported on Chrome apps".
///
/// An iOS client is public: it has no client secret and relies on PKCE, which is
/// why TokenEndpoint never sends one. The id is the Doppler
/// `GOOGLE_SAFARI_CLIENT_ID` for the command-center project. It is not a secret,
/// so it lives in source like the dashboard's own client id. Its bundle id is
/// com.strategicnerds.commandcenter. See docs/safari-release-setup.md.
enum AppConfig {
    static let googleClientID =
        "180895780616-l9tc3n0c93tguvt8tunehvu8tv24algv.apps.googleusercontent.com"

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
