import XCTest
@testable import CommandCenterCore

private func route(_ string: String) -> CommandCenterRoute? {
    guard let url = URL(string: string) else { return nil }
    return parseRoute(url)
}

final class RoutingTests: XCTestCase {
    func testParsesSettings() {
        XCTAssertEqual(route("commandcenter://settings"), .settings)
    }

    func testParsesJoinWithPlatform() {
        let parsed = route("commandcenter://join?url=https://meet.google.com/abc&platform=meet")
        XCTAssertEqual(
            parsed,
            .join(url: URL(string: "https://meet.google.com/abc")!, platform: .meet)
        )
    }

    func testJoinAllowsZoomSubdomains() {
        let parsed = route("commandcenter://join?url=https://acme.zoom.us/j/123&platform=zoom")
        if case .join = parsed { return }
        XCTFail("expected a join route for a zoom subdomain")
    }

    func testJoinRefusesANonMeetingHost() {
        XCTAssertNil(route("commandcenter://join?url=https://evil.example.com/x"))
    }

    func testJoinRefusesADangerousScheme() {
        XCTAssertNil(route("commandcenter://join?url=javascript:alert(1)&platform=meet"))
        XCTAssertNil(route("commandcenter://join?url=file:///etc/passwd"))
    }

    func testJoinRefusesAnEncodedDangerousScheme() {
        // %6A... is "javascript:"; URLComponents decodes it, validation still refuses.
        XCTAssertNil(route("commandcenter://join?url=javascript%3Aalert(1)&platform=meet"))
    }

    func testParsesOpenForHttps() {
        XCTAssertEqual(
            route("commandcenter://open?url=https://notion.so/x"),
            .open(url: URL(string: "https://notion.so/x")!)
        )
    }

    func testOpenRefusesNonHttps() {
        XCTAssertNil(route("commandcenter://open?url=file:///etc/passwd"))
    }

    func testParsesOpenProviderWithAppSchemeUrl() {
        let parsed = route("commandcenter://openProvider?providerId=linear-bar&url=linearbar://open")
        XCTAssertEqual(
            parsed,
            .openProvider(providerId: "linear-bar", url: URL(string: "linearbar://open"))
        )
    }

    func testOpenProviderRefusesADangerousUrl() {
        XCTAssertNil(route("commandcenter://openProvider?providerId=x&url=javascript:1"))
    }

    func testOpenProviderRequiresAProviderId() {
        XCTAssertNil(route("commandcenter://openProvider?url=linearbar://open"))
    }

    func testIgnoresANonCommandCenterScheme() {
        XCTAssertNil(route("https://example.com"))
        XCTAssertNil(route("commandcenter://unknownAction"))
    }
}

final class BrowserRoutingTests: XCTestCase {
    private let routing = ["meet": "com.google.Chrome", "zoom": "system", "teams": "com.apple.Safari"]

    func testRoutesAPlatformToItsBrowser() {
        XCTAssertEqual(resolveBrowserBundleId(platform: .meet, routing: routing), "com.google.Chrome")
        XCTAssertEqual(resolveBrowserBundleId(platform: .teams, routing: routing), "com.apple.Safari")
    }

    func testSystemMeansTheDefaultBrowser() {
        XCTAssertNil(resolveBrowserBundleId(platform: .zoom, routing: routing))
    }

    func testFallsBackToOtherWhenAPlatformIsUnset() {
        let withOther = routing.merging(["other": "com.brave.Browser"]) { _, new in new }
        XCTAssertEqual(resolveBrowserBundleId(platform: .webex, routing: withOther), "com.brave.Browser")
    }

    func testExtractsBrowserRoutingFromSettings() {
        let settings = JSONValue.object([
            "browserRouting": .object([
                "meet": .string("com.google.Chrome"),
                "zoom": .string("system"),
            ]),
        ])
        XCTAssertEqual(browserRouting(from: settings)["meet"], "com.google.Chrome")
    }

    func testBrowserChoiceBundleIds() {
        XCTAssertEqual(BrowserChoice.chrome.bundleId, "com.google.Chrome")
        XCTAssertNil(BrowserChoice.system.bundleId)
    }
}
