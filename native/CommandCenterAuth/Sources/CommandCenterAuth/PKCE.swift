import CryptoKit
import Foundation

/// PKCE (RFC 7636) for the authorization-code flow. A desktop OAuth client is
/// public — it ships with no usable secret — so PKCE is what stops an
/// intercepted authorization code from being redeemed by anyone but us: the code
/// is bound to a one-time verifier that only this process holds. We always use
/// S256 (never "plain"), which Google requires for desktop clients.
public struct PKCE: Equatable {
    /// The high-entropy secret kept in memory and sent only on the token exchange.
    public let verifier: String
    /// base64url(SHA256(verifier)), sent on the authorization request.
    public let challenge: String

    /// Derive the challenge for a given verifier. Pure, so it is testable against
    /// the RFC 7636 Appendix B vector.
    public init(verifier: String) {
        self.verifier = verifier
        let digest = SHA256.hash(data: Data(verifier.utf8))
        self.challenge = Data(digest).base64URLEncodedString()
    }

    /// A fresh PKCE pair with a 32-byte (256-bit) random verifier, base64url with
    /// no padding — within the RFC's 43...128 character range.
    public static func random() -> PKCE {
        var bytes = [UInt8](repeating: 0, count: 32)
        _ = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        return PKCE(verifier: Data(bytes).base64URLEncodedString())
    }
}

extension Data {
    /// base64url without padding: base64, then +/= → -_ and drop "=", per the
    /// URL-safe alphabet OAuth uses for both the challenge and JWT segments.
    func base64URLEncodedString() -> String {
        base64EncodedString()
            .replacingOccurrences(of: "+", with: "-")
            .replacingOccurrences(of: "/", with: "_")
            .replacingOccurrences(of: "=", with: "")
    }

    /// Decode a base64url string (no padding) back to bytes, re-padding as needed.
    /// Returns nil on invalid input.
    static func fromBase64URL(_ string: String) -> Data? {
        var base64 = string
            .replacingOccurrences(of: "-", with: "+")
            .replacingOccurrences(of: "_", with: "/")
        let remainder = base64.count % 4
        if remainder > 0 {
            base64.append(String(repeating: "=", count: 4 - remainder))
        }
        return Data(base64Encoded: base64)
    }
}
