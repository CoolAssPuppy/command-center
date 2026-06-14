import XCTest
@testable import CommandCenterCore

final class DashboardComposerTests: XCTestCase {
    private var container: URL!

    override func setUpWithError() throws {
        container = try makeTempContainer()
    }

    private func write(_ contents: String, to relativePath: String) throws {
        try write(contents, to: relativePath, in: container)
    }

    private func seedProviderAndSettings() throws {
        try write(
            """
            {
              "schemaVersion": 1, "providerId": "linear-bar", "displayName": "Linear",
              "bundleId": "com.sn.Linear", "feeds": [{ "kind": "linear.inbox", "path": "feed.json" }]
            }
            """,
            to: "Providers/linear-bar/manifest.json"
        )
        try write(
            """
            {
              "schemaVersion": 1, "providerId": "linear-bar", "kind": "linear.inbox",
              "updatedAt": "2026-06-14T15:04:05Z", "status": "ok",
              "glance": { "value": "3", "label": "unread" }, "data": { "items": [] }
            }
            """,
            to: "Providers/linear-bar/feed.json"
        )
        try write(#"{ "profile": { "name": "Prashant" } }"#, to: "CommandCenter/settings.json")
    }

    private func composer(installed: Set<String>) -> DashboardComposer {
        DashboardComposer(
            feedStore: FeedStore(containerURL: container, locator: StubLocator(installed: installed))
        )
    }

    func testComposesInstalledProvidersAndSettings() throws {
        try seedProviderAndSettings()

        let payload = composer(installed: ["com.sn.Linear"]).compose(generatedAt: "2026-06-14T15:05:00Z")

        XCTAssertEqual(payload.providers.count, 1)
        XCTAssertEqual(payload.generatedAt, "2026-06-14T15:05:00Z")
        XCTAssertEqual(
            payload.settings?.objectValue?["profile"]?.objectValue?["name"]?.stringValue,
            "Prashant"
        )
    }

    func testComposeJsonRoundTripsThroughTheDecoder() throws {
        try seedProviderAndSettings()

        let data = composer(installed: ["com.sn.Linear"]).composeJSON(generatedAt: "2026-06-14T15:05:00Z")

        guard case .success(let decoded) = decodeDashboardPayload(data) else {
            return XCTFail("composed JSON should decode")
        }
        XCTAssertEqual(decoded.providers.first?.manifest.providerId, "linear-bar")
    }

    func testEmptyContainerComposesAnEmptyPayload() {
        let payload = composer(installed: []).compose(generatedAt: "2026-06-14T15:05:00Z")

        XCTAssertTrue(payload.providers.isEmpty)
        XCTAssertNil(payload.settings)
    }
}
