import Foundation

/// Google's token endpoint response, for both the authorization_code exchange
/// and the refresh_token grant. A refresh response usually omits refresh_token
/// (the original stays valid) and id_token, so both are optional. Decoding is
/// pure and tested; the network call that produces the bytes lives in the app.
public struct TokenResponse: Codable, Equatable {
    public let accessToken: String
    public let expiresIn: Int
    public let refreshToken: String?
    public let idToken: String?

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case expiresIn = "expires_in"
        case refreshToken = "refresh_token"
        case idToken = "id_token"
    }

    /// The absolute expiry in epoch milliseconds, computed from a base time so
    /// the browser can compare it against Date.now() without clock assumptions.
    public func expiresAtMillis(now: Date) -> Int64 {
        Int64((now.timeIntervalSince1970 + Double(expiresIn)) * 1000)
    }
}

/// Builds the token-endpoint POST requests. Kept pure (no URLSession) so the body
/// encoding is unit-tested; the app just runs the returned request.
public enum TokenEndpoint {
    /// Exchange an authorization code for tokens, proving possession of the PKCE
    /// verifier that the code was bound to.
    public static func codeExchangeRequest(
        config: OAuthConfig,
        code: String,
        verifier: String
    ) -> URLRequest {
        formRequest(url: config.tokenEndpoint, fields: [
            "client_id": config.clientID,
            "code": code,
            "code_verifier": verifier,
            "grant_type": "authorization_code",
            "redirect_uri": config.redirectURI,
        ])
    }

    /// Trade a stored refresh token for a fresh access token, with no UI. This is
    /// the silent path used when an access token has expired.
    public static func refreshRequest(
        config: OAuthConfig,
        refreshToken: String
    ) -> URLRequest {
        formRequest(url: config.tokenEndpoint, fields: [
            "client_id": config.clientID,
            "refresh_token": refreshToken,
            "grant_type": "refresh_token",
        ])
    }

    private static func formRequest(url: URL, fields: [String: String]) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
        request.httpBody = encodeForm(fields)
        return request
    }

    /// Encode form fields with a stable key order so the body is deterministic
    /// (which is what lets a test assert it), percent-escaping each value.
    static func encodeForm(_ fields: [String: String]) -> Data {
        let body = fields
            .sorted { $0.key < $1.key }
            .map { "\(escape($0.key))=\(escape($0.value))" }
            .joined(separator: "&")
        return Data(body.utf8)
    }

    private static func escape(_ value: String) -> String {
        var allowed = CharacterSet.alphanumerics
        allowed.insert(charactersIn: "-._~")
        return value.addingPercentEncoding(withAllowedCharacters: allowed) ?? value
    }
}
