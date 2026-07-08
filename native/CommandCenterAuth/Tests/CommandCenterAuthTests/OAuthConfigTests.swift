import XCTest
@testable import CommandCenterAuth

final class OAuthConfigTests: XCTestCase {
    private func config() -> OAuthConfig {
        OAuthConfig(clientID: "cid.apps.googleusercontent.com", redirectURI: "http://127.0.0.1:7421/cb")
    }

    private func params(_ url: URL) -> [String: String] {
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []
        return Dictionary(items.map { ($0.name, $0.value ?? "") }, uniquingKeysWith: { first, _ in first })
    }

    func testInteractiveAuthorizationURLCarriesPKCEAndConsent() {
        let pkce = PKCE(verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")
        let url = config().authorizationURL(pkce: pkce, state: "xyz", interactive: true)
        let query = params(url)

        XCTAssertEqual(query["response_type"], "code")
        XCTAssertEqual(query["code_challenge_method"], "S256")
        XCTAssertEqual(query["code_challenge"], pkce.challenge)
        XCTAssertEqual(query["redirect_uri"], "http://127.0.0.1:7421/cb")
        XCTAssertEqual(query["access_type"], "offline")
        XCTAssertEqual(query["prompt"], "select_account consent")
        XCTAssertEqual(query["state"], "xyz")
        XCTAssertEqual(query["scope"], OAuthConfig.defaultScopes.joined(separator: " "))
        XCTAssertNil(query["login_hint"])
    }

    func testSilentAuthorizationURLPinsTheAccount() {
        let url = config().authorizationURL(
            pkce: .random(), state: "s", interactive: false, loginHint: "user@example.com"
        )
        let query = params(url)
        XCTAssertEqual(query["prompt"], "consent")
        XCTAssertEqual(query["login_hint"], "user@example.com")
    }

    func testEmptyLoginHintIsOmitted() {
        let url = config().authorizationURL(pkce: .random(), state: "s", interactive: false, loginHint: "")
        XCTAssertNil(params(url)["login_hint"])
    }
}
