import Foundation

/// Static Google OAuth configuration for the desktop (loopback) client the
/// container app owns. The client id is not a secret and ships in the app; there
/// is deliberately no client secret (a desktop client is public and relies on
/// PKCE instead). The scopes mirror the extension's Chrome config exactly so the
/// Safari and Chrome builds request identical access.
public struct OAuthConfig: Equatable {
    public let clientID: String
    public let scopes: [String]
    public let authorizationEndpoint: URL
    public let tokenEndpoint: URL
    /// The loopback redirect Google sends the code back to. Google matches this
    /// exactly against the redirect URIs registered on the desktop client.
    public let redirectURI: String

    public init(
        clientID: String,
        scopes: [String] = OAuthConfig.defaultScopes,
        authorizationEndpoint: URL = URL(string: "https://accounts.google.com/o/oauth2/v2/auth")!,
        tokenEndpoint: URL = URL(string: "https://oauth2.googleapis.com/token")!,
        redirectURI: String
    ) {
        self.clientID = clientID
        self.scopes = scopes
        self.authorizationEndpoint = authorizationEndpoint
        self.tokenEndpoint = tokenEndpoint
        self.redirectURI = redirectURI
    }

    /// Read-only calendar and tasks, plus identity, matching googleOAuthConfig.ts.
    public static let defaultScopes = [
        "openid",
        "email",
        "https://www.googleapis.com/auth/calendar.readonly",
        "https://www.googleapis.com/auth/tasks.readonly",
    ]

    /// Build the authorization URL that ASWebAuthenticationSession opens. An
    /// interactive sign-in forces the account chooser and consent (so a refresh
    /// token is issued); a re-consent pins the account with login_hint. Pure and
    /// tested: given the same inputs it produces the same query.
    public func authorizationURL(
        pkce: PKCE,
        state: String,
        interactive: Bool,
        loginHint: String? = nil
    ) -> URL {
        var components = URLComponents(url: authorizationEndpoint, resolvingAgainstBaseURL: false)!
        var items = [
            URLQueryItem(name: "client_id", value: clientID),
            URLQueryItem(name: "response_type", value: "code"),
            URLQueryItem(name: "redirect_uri", value: redirectURI),
            URLQueryItem(name: "scope", value: scopes.joined(separator: " ")),
            URLQueryItem(name: "code_challenge", value: pkce.challenge),
            URLQueryItem(name: "code_challenge_method", value: "S256"),
            URLQueryItem(name: "state", value: state),
            // offline access is what makes Google return a refresh token, so a
            // silent renewal later needs no window.
            URLQueryItem(name: "access_type", value: "offline"),
            URLQueryItem(name: "prompt", value: interactive ? "select_account consent" : "consent"),
        ]
        if let loginHint, !loginHint.isEmpty {
            items.append(URLQueryItem(name: "login_hint", value: loginHint))
        }
        components.queryItems = items
        return components.url!
    }
}
