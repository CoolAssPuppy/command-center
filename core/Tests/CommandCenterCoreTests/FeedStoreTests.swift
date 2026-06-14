import XCTest
@testable import CommandCenterCore

final class FeedStoreTests: XCTestCase {
    private var container: URL!

    override func setUpWithError() throws {
        container = try makeTempContainer()
    }

    private func write(_ contents: String, to relativePath: String) throws {
        try write(contents, to: relativePath, in: container)
    }

    private func manifest(providerId: String, bundleId: String, feedPath: String = "feed.json") -> String {
        """
        {
          "schemaVersion": 1, "providerId": "\(providerId)", "displayName": "\(providerId)",
          "bundleId": "\(bundleId)", "feeds": [{ "kind": "linear.inbox", "path": "\(feedPath)" }]
        }
        """
    }

    private let feed = """
    {
      "schemaVersion": 1, "providerId": "linear-bar", "kind": "linear.inbox",
      "updatedAt": "2026-06-14T15:04:05Z", "status": "ok",
      "glance": { "value": "3", "label": "unread" }, "data": { "items": [] }
    }
    """

    private func store(installed: Set<String>) -> FeedStore {
        FeedStore(containerURL: container, locator: StubLocator(installed: installed))
    }

    func testLoadsAnInstalledProviderWithItsFeed() throws {
        try write(manifest(providerId: "linear-bar", bundleId: "com.sn.Linear"), to: "Providers/linear-bar/manifest.json")
        try write(feed, to: "Providers/linear-bar/feed.json")

        let providers = store(installed: ["com.sn.Linear"]).loadProviders()

        XCTAssertEqual(providers.count, 1)
        XCTAssertEqual(providers.first?.feeds.count, 1)
        XCTAssertEqual(providers.first?.feeds.first?.glance.value, "3")
    }

    func testDropsProvidersWhoseAppIsNotInstalled() throws {
        try write(manifest(providerId: "linear-bar", bundleId: "com.sn.Linear"), to: "Providers/linear-bar/manifest.json")
        try write(feed, to: "Providers/linear-bar/feed.json")

        XCTAssertTrue(store(installed: []).loadProviders().isEmpty)
    }

    func testIncludesAProviderButDropsAMissingFeed() throws {
        try write(manifest(providerId: "linear-bar", bundleId: "com.sn.Linear"), to: "Providers/linear-bar/manifest.json")
        // no feed file written

        let providers = store(installed: ["com.sn.Linear"]).loadProviders()
        XCTAssertEqual(providers.count, 1)
        XCTAssertEqual(providers.first?.feeds.count, 0)
    }

    func testSkipsADirectoryWithoutAManifest() throws {
        try write("placeholder", to: "Providers/empty/note.txt")
        XCTAssertTrue(store(installed: ["com.sn.Linear"]).loadProviders().isEmpty)
    }

    func testSkipsAMalformedManifest() throws {
        try write("{ not json", to: "Providers/broken/manifest.json")
        XCTAssertTrue(store(installed: ["com.sn.Linear"]).loadProviders().isEmpty)
    }

    func testRefusesAFeedPathThatEscapesTheProviderFolder() throws {
        try write(
            manifest(providerId: "evil", bundleId: "com.sn.Evil", feedPath: "../../secret.json"),
            to: "Providers/evil/manifest.json"
        )
        try write(feed, to: "secret.json") // outside the provider folder

        let providers = store(installed: ["com.sn.Evil"]).loadProviders()
        XCTAssertEqual(providers.count, 1)
        XCTAssertEqual(providers.first?.feeds.count, 0, "traversal must be refused")
    }

    func testRefusesAFeedThatIsASymlinkOutsideTheProviderFolder() throws {
        try write(
            manifest(providerId: "evil", bundleId: "com.sn.Evil", feedPath: "linked.json"),
            to: "Providers/evil/manifest.json"
        )
        try write(feed, to: "secret.json") // outside the provider folder
        try FileManager.default.createSymbolicLink(
            at: container.appendingPathComponent("Providers/evil/linked.json"),
            withDestinationURL: container.appendingPathComponent("secret.json")
        )

        let providers = store(installed: ["com.sn.Evil"]).loadProviders()
        XCTAssertEqual(providers.first?.feeds.count, 0, "symlink escape must be refused")
    }

    func testLoadsSettingsWhenPresentAndNilWhenNot() throws {
        XCTAssertNil(store(installed: []).loadSettings())

        try write(#"{ "profile": { "name": "Prashant" } }"#, to: "CommandCenter/settings.json")
        let settings = store(installed: []).loadSettings()
        XCTAssertEqual(
            settings?.objectValue?["profile"]?.objectValue?["name"]?.stringValue,
            "Prashant"
        )
    }
}
