import XCTest
@testable import CommandCenterAuth

final class PKCETests: XCTestCase {
    // RFC 7636 Appendix B: the canonical verifier → S256 challenge vector. If our
    // base64url or SHA-256 is wrong, this fails.
    func testMatchesRFC7636Vector() {
        let pkce = PKCE(verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
        XCTAssertEqual(pkce.challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
    }

    func testRandomVerifierIsUrlSafeAndInRange() {
        let pkce = PKCE.random()
        XCTAssertGreaterThanOrEqual(pkce.verifier.count, 43)
        XCTAssertLessThanOrEqual(pkce.verifier.count, 128)
        // base64url alphabet only: no +, /, or = padding.
        XCTAssertNil(pkce.verifier.rangeOfCharacter(from: CharacterSet(charactersIn: "+/=")))
    }

    func testRandomPairsDiffer() {
        XCTAssertNotEqual(PKCE.random().verifier, PKCE.random().verifier)
    }

    func testBase64URLRoundTrip() {
        let original = Data([0xFB, 0xFF, 0x00, 0x10, 0x3D, 0x7E])
        let encoded = original.base64URLEncodedString()
        XCTAssertNil(encoded.rangeOfCharacter(from: CharacterSet(charactersIn: "+/=")))
        XCTAssertEqual(Data.fromBase64URL(encoded), original)
    }
}
