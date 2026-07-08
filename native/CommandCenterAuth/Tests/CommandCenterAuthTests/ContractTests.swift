import XCTest
@testable import CommandCenterAuth

final class ContractTests: XCTestCase {
    func testWireFramingRoundTrips() {
        let payload = Data("hello world".utf8)
        let framed = AuthWire.frame(payload)
        XCTAssertEqual(framed.count, 4 + payload.count)
        let length = AuthWire.decodeLength(framed.prefix(4))
        XCTAssertEqual(length, payload.count)
        XCTAssertEqual(framed.suffix(payload.count), payload)
    }

    func testDecodeLengthRejectsOutOfBounds() {
        XCTAssertNil(AuthWire.decodeLength(Data([0, 0, 0])))          // too short
        XCTAssertNil(AuthWire.decodeLength(Data([0, 0, 0, 0])))       // zero length
        XCTAssertNil(AuthWire.decodeLength(Data([0xFF, 0xFF, 0xFF, 0xFF]))) // over the cap
    }

    func testRequestDecodesTheBrowserContract() {
        let json = Data(#"{"type":"google-authorize","interactive":true,"loginHint":"a@b.co"}"#.utf8)
        let request = AuthorizeCoding.decodeRequest(json)
        XCTAssertEqual(request, AuthorizeRequest(interactive: true, loginHint: "a@b.co"))
    }

    func testRequestDecodesWithoutLoginHint() {
        let json = Data(#"{"type":"google-authorize","interactive":false}"#.utf8)
        XCTAssertEqual(AuthorizeCoding.decodeRequest(json)?.loginHint, nil)
    }

    func testSuccessResponseEncodesToTheBrowserShape() throws {
        let token = GoogleToken(accessToken: "ya29", expiresAt: 1_720_003_600_000, email: "a@b.co")
        let data = AuthorizeCoding.encode(.success(token))
        let object = try XCTUnwrap(
            try JSONSerialization.jsonObject(with: data) as? [String: Any]
        )
        XCTAssertEqual(object["ok"] as? Bool, true)
        let tokenObject = try XCTUnwrap(object["token"] as? [String: Any])
        XCTAssertEqual(tokenObject["accessToken"] as? String, "ya29")
        XCTAssertEqual(tokenObject["expiresAt"] as? Int64 ?? Int64(tokenObject["expiresAt"] as? Int ?? 0),
                       1_720_003_600_000)
        XCTAssertEqual(tokenObject["email"] as? String, "a@b.co")
        XCTAssertNil(object["error"])
    }

    func testFailureResponseHasNoToken() throws {
        let data = AuthorizeCoding.encode(.failure("consent_required"))
        let object = try XCTUnwrap(try JSONSerialization.jsonObject(with: data) as? [String: Any])
        XCTAssertEqual(object["ok"] as? Bool, false)
        XCTAssertEqual(object["error"] as? String, "consent_required")
        XCTAssertNil(object["token"])
    }

    func testResponseRoundTrips() {
        let token = GoogleToken(accessToken: "t", expiresAt: 42, email: nil)
        let decoded = AuthorizeCoding.decodeResponse(AuthorizeCoding.encode(.success(token)))
        XCTAssertEqual(decoded, .success(token))
    }

    func testIDTokenEmailDecode() {
        // A JWT whose payload is {"email":"jane@example.com","email_verified":true}.
        let payload = Data(#"{"email":"jane@example.com","email_verified":true}"#.utf8)
        let jwt = "header.\(payload.base64URLEncodedString()).signature"
        XCTAssertEqual(IDToken.email(from: jwt), "jane@example.com")
    }

    func testIDTokenEmailDecodeRejectsGarbage() {
        XCTAssertNil(IDToken.email(from: "not-a-jwt"))
        XCTAssertNil(IDToken.email(from: "a.b"))
    }
}
