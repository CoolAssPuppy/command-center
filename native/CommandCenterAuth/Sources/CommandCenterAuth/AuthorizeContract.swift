import Foundation

/// The message the extension's new tab page sends, forwarded verbatim by the
/// appex to the app over the loopback. The keys match the TypeScript bridge in
/// dashboard/src/bridge/native.ts; changing either side without the other breaks
/// sign-in, so the two are kept in step by shape, not by comment alone.
public struct AuthorizeRequest: Codable, Equatable {
    public let type: String
    public let interactive: Bool
    public let loginHint: String?

    public init(type: String = "google-authorize", interactive: Bool, loginHint: String? = nil) {
        self.type = type
        self.interactive = interactive
        self.loginHint = loginHint
    }
}

/// The short-lived token handed back to the browser. expiresAt is epoch
/// milliseconds (the browser compares it against Date.now()), and it maps exactly
/// to the TS GoogleTokenSchema { accessToken, expiresAt, email? }. The refresh
/// token is deliberately absent: it never leaves the app process.
public struct GoogleToken: Codable, Equatable {
    public let accessToken: String
    public let expiresAt: Int64
    public let email: String?

    public init(accessToken: String, expiresAt: Int64, email: String? = nil) {
        self.accessToken = accessToken
        self.expiresAt = expiresAt
        self.email = email
    }
}

/// The reply the app frames back to the appex, which returns it to the page. On
/// success `ok` is true and `token` is set; on failure `ok` is false and `error`
/// carries an advisory reason. The browser only trusts a token when ok is true.
public struct AuthorizeResponse: Codable, Equatable {
    public let ok: Bool
    public let token: GoogleToken?
    public let error: String?

    private init(ok: Bool, token: GoogleToken?, error: String?) {
        self.ok = ok
        self.token = token
        self.error = error
    }

    public static func success(_ token: GoogleToken) -> AuthorizeResponse {
        AuthorizeResponse(ok: true, token: token, error: nil)
    }

    public static func failure(_ error: String) -> AuthorizeResponse {
        AuthorizeResponse(ok: false, token: nil, error: error)
    }
}

/// JSON coding for the loopback, isolated so both processes encode identically.
public enum AuthorizeCoding {
    public static func encode(_ response: AuthorizeResponse) -> Data {
        (try? JSONEncoder().encode(response)) ?? Data(#"{"ok":false,"error":"encode_failed"}"#.utf8)
    }

    public static func decodeRequest(_ data: Data) -> AuthorizeRequest? {
        try? JSONDecoder().decode(AuthorizeRequest.self, from: data)
    }

    public static func decodeResponse(_ data: Data) -> AuthorizeResponse? {
        try? JSONDecoder().decode(AuthorizeResponse.self, from: data)
    }
}
