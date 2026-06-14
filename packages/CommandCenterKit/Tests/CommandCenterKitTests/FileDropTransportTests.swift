import CommandCenterCore
import XCTest
@testable import CommandCenterKit

final class FileDropTransportTests: XCTestCase {
    private var container: URL!

    override func setUpWithError() throws {
        container = FileManager.default.temporaryDirectory
            .appendingPathComponent("cck-filedrop-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: container, withIntermediateDirectories: true)
        addTeardownBlock { [container] in
            if let container { try? FileManager.default.removeItem(at: container) }
        }
    }

    private let manifest = JSONValue.object([
        "schemaVersion": .number(1),
        "providerId": .string("acme"),
        "displayName": .string("Acme"),
        "bundleId": .string("com.acme.app"),
        "feeds": .array([.object(["kind": .string("linear.inbox"), "path": .string("feed.json")])]),
    ])

    private let feed = JSONValue.object([
        "schemaVersion": .number(1),
        "providerId": .string("acme"),
        "kind": .string("linear.inbox"),
        "updatedAt": .string("2026-06-14T15:04:05Z"),
        "status": .string("ok"),
        "glance": .object(["value": .string("5"), "label": .string("unread")]),
        "data": .object(["items": .array([])]),
    ])

    func testRegisterThenPublishWritesAFeedStoreReadableProvider() async throws {
        let center = CommandCenter(
            providerId: "acme", displayName: "Acme", bundleId: "com.acme.app",
            transport: FileDropTransport(containerURL: container)
        )

        try await center.register(manifest: manifest)
        try await center.publish(feed, to: "feed.json")

        let providers = FeedStore(containerURL: container, locator: AllInstalledProviderLocator()).loadProviders()
        XCTAssertEqual(providers.count, 1)
        XCTAssertEqual(providers.first?.feeds.first?.glance.value, "5")
    }

    func testWellKnownContainerIsUnderApplicationSupport() {
        let url = FileDropTransport.wellKnownContainerURL()
        XCTAssertEqual(url.lastPathComponent, "Command Center")
    }
}
