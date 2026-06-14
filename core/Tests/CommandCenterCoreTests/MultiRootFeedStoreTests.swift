import XCTest
@testable import CommandCenterCore

final class MultiRootFeedStoreTests: XCTestCase {
    private var rootA: URL!
    private var rootB: URL!

    override func setUpWithError() throws {
        rootA = try makeTempContainer()
        rootB = try makeTempContainer()
    }

    private func manifest(_ providerId: String, bundleId: String, displayName: String) -> String {
        """
        {
          "schemaVersion": 1, "providerId": "\(providerId)", "displayName": "\(displayName)",
          "bundleId": "\(bundleId)", "feeds": []
        }
        """
    }

    private func source(installed: Set<String>) -> MultiRootFeedStore {
        MultiRootFeedStore(containerURLs: [rootA, rootB], locator: StubLocator(installed: installed))
    }

    func testUnionsProvidersFromEveryRoot() throws {
        try write(manifest("a", bundleId: "com.a", displayName: "A"), to: "Providers/a/manifest.json", in: rootA)
        try write(manifest("b", bundleId: "com.b", displayName: "B"), to: "Providers/b/manifest.json", in: rootB)

        let ids = source(installed: ["com.a", "com.b"]).loadProviders().map { $0.manifest.providerId }.sorted()
        XCTAssertEqual(ids, ["a", "b"])
    }

    func testEarlierRootWinsOnAProviderIdCollision() throws {
        try write(manifest("dup", bundleId: "com.dup", displayName: "First"), to: "Providers/dup/manifest.json", in: rootA)
        try write(manifest("dup", bundleId: "com.dup", displayName: "Second"), to: "Providers/dup/manifest.json", in: rootB)

        let providers = source(installed: ["com.dup"]).loadProviders()
        XCTAssertEqual(providers.count, 1)
        XCTAssertEqual(providers.first?.manifest.displayName, "First")
    }

    func testSettingsComeFromTheFirstRootThatHasThem() throws {
        try write(#"{ "from": "B" }"#, to: "CommandCenter/settings.json", in: rootB)

        // rootA has no settings, so rootB's are used.
        XCTAssertEqual(
            source(installed: []).loadSettings()?.objectValue?["from"]?.stringValue,
            "B"
        )

        try write(#"{ "from": "A" }"#, to: "CommandCenter/settings.json", in: rootA)
        XCTAssertEqual(
            source(installed: []).loadSettings()?.objectValue?["from"]?.stringValue,
            "A"
        )
    }
}
