import XCTest
@testable import CommandCenterCore

private struct SettingsStubLocator: ProviderLocator {
    func isInstalled(bundleId: String) -> Bool { true }
}

final class SettingsStoreTests: XCTestCase {
    private var container: URL!

    override func setUpWithError() throws {
        container = FileManager.default.temporaryDirectory
            .appendingPathComponent("cc-settings-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: container, withIntermediateDirectories: true)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: container)
    }

    private func store() -> SettingsStore {
        SettingsStore(containerURL: container)
    }

    func testWritesAndReadsBackTheSameDocument() throws {
        let settings = JSONValue.object(["profile": .object(["name": .string("Prashant")])])

        try store().write(settings)

        XCTAssertEqual(store().read(), settings)
    }

    func testReadIsNilBeforeAnythingIsWritten() {
        XCTAssertNil(store().read())
    }

    func testCreatesTheCommandCenterDirectoryOnWrite() throws {
        try store().write(.object([:]))

        let dir = container.appendingPathComponent("CommandCenter/settings.json")
        XCTAssertTrue(FileManager.default.fileExists(atPath: dir.path))
    }

    func testFeedStoreReadsWhatSettingsStoreWrites() throws {
        try store().write(defaultSettingsDocument())

        let viaFeedStore = FeedStore(containerURL: container, locator: SettingsStubLocator()).loadSettings()
        XCTAssertEqual(
            viaFeedStore?.objectValue?["browserRouting"]?.objectValue?["meet"]?.stringValue,
            "com.google.Chrome"
        )
    }

    func testDefaultDocumentRoundTrips() throws {
        try store().write(defaultSettingsDocument())
        XCTAssertEqual(store().read(), defaultSettingsDocument())
    }

    func testDefaultDocumentHasExpectedShape() {
        let defaults = defaultSettingsDocument().objectValue
        XCTAssertEqual(defaults?["appearance"]?.objectValue?["theme"]?.stringValue, "system")
        XCTAssertNotNil(defaults?["worldClock"]?.objectValue?["cities"]?.arrayValue)
    }
}
