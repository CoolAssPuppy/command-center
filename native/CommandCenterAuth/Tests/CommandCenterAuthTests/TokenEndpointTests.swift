import XCTest
@testable import CommandCenterAuth

final class TokenEndpointTests: XCTestCase {
    private func config() -> OAuthConfig {
        OAuthConfig(clientID: "cid", redirectURI: "http://127.0.0.1:7421/cb")
    }

    private func body(_ request: URLRequest) -> String {
        String(data: request.httpBody ?? Data(), encoding: .utf8) ?? ""
    }

    func testDecodesAFullExchangeResponse() throws {
        let json = Data("""
        {"access_token":"ya29.abc","expires_in":3599,"refresh_token":"1//rt","id_token":"h.p.s","token_type":"Bearer"}
        """.utf8)
        let response = try JSONDecoder().decode(TokenResponse.self, from: json)
        XCTAssertEqual(response.accessToken, "ya29.abc")
        XCTAssertEqual(response.expiresIn, 3599)
        XCTAssertEqual(response.refreshToken, "1//rt")
        XCTAssertEqual(response.idToken, "h.p.s")
    }

    func testDecodesARefreshResponseWithoutRefreshToken() throws {
        let json = Data(#"{"access_token":"ya29.new","expires_in":3600}"#.utf8)
        let response = try JSONDecoder().decode(TokenResponse.self, from: json)
        XCTAssertEqual(response.accessToken, "ya29.new")
        XCTAssertNil(response.refreshToken)
        XCTAssertNil(response.idToken)
    }

    func testExpiresAtIsEpochMilliseconds() {
        let response = TokenResponse(from: "ya29", expiresIn: 3600)
        let now = Date(timeIntervalSince1970: 1_000_000)
        XCTAssertEqual(response.expiresAtMillis(now: now), Int64((1_000_000 + 3600) * 1000))
    }

    func testCodeExchangeBodyHasGrantAndVerifier() {
        let request = TokenEndpoint.codeExchangeRequest(config: config(), code: "abc", verifier: "ver")
        XCTAssertEqual(request.httpMethod, "POST")
        XCTAssertEqual(
            request.value(forHTTPHeaderField: "Content-Type"),
            "application/x-www-form-urlencoded"
        )
        let form = body(request)
        XCTAssertTrue(form.contains("grant_type=authorization_code"))
        XCTAssertTrue(form.contains("code=abc"))
        XCTAssertTrue(form.contains("code_verifier=ver"))
        XCTAssertTrue(form.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A7421%2Fcb"))
    }

    func testRefreshBodyUsesRefreshGrant() {
        let request = TokenEndpoint.refreshRequest(config: config(), refreshToken: "1//rt")
        let form = body(request)
        XCTAssertTrue(form.contains("grant_type=refresh_token"))
        XCTAssertTrue(form.contains("refresh_token=1%2F%2Frt"))
    }
}

// A tiny test-only initializer so the millis math can be checked without a live
// endpoint response.
private extension TokenResponse {
    init(from accessToken: String, expiresIn: Int) {
        let json = Data(#"{"access_token":"\#(accessToken)","expires_in":\#(expiresIn)}"#.utf8)
        self = try! JSONDecoder().decode(TokenResponse.self, from: json)
    }
}
