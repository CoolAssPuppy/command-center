import Foundation

/// Reads the email claim out of a Google id_token. The id_token is a JWT
/// (header.payload.signature); we base64url-decode the payload and read "email".
/// Signature verification is intentionally skipped: the token did not come from
/// an untrusted caller, it came straight from Google's TLS token endpoint in this
/// same process, so a signature check would guard nothing. The value only labels
/// the connection and pins the next silent refresh, never an authorization.
public enum IDToken {
    public static func email(from idToken: String) -> String? {
        let segments = idToken.split(separator: ".")
        guard segments.count >= 2,
              let payload = Data.fromBase64URL(String(segments[1])),
              let claims = try? JSONSerialization.jsonObject(with: payload) as? [String: Any],
              let email = claims["email"] as? String,
              !email.isEmpty
        else { return nil }
        return email
    }
}
