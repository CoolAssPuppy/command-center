import CommandCenterCore
import XCTest
@testable import SampleProvider

final class SampleProviderTests: XCTestCase {
    func testPublishesAFeedStoreReadableProvider() async throws {
        let dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("sample-provider-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        defer { try? FileManager.default.removeItem(at: dir) }

        try await SampleProvider.publish(to: dir)

        let providers = FeedStore(containerURL: dir, locator: AllInstalledProviderLocator()).loadProviders()
        XCTAssertEqual(providers.count, 1)
        XCTAssertEqual(providers.first?.manifest.providerId, "com.example.deploybot")

        let feed = providers.first?.feeds.first
        XCTAssertEqual(feed?.kind, "card")
        XCTAssertEqual(feed?.glance.value, "2")
    }

    func testTheFeedDecodesAsAValidEnvelope() {
        let data = try? JSONEncoder().encode(SampleProvider.feed())
        guard let data, case .success(let feed) = decodeFeedEnvelope(data) else {
            return XCTFail("the sample feed should be a valid envelope")
        }
        XCTAssertEqual(feed.providerId, "com.example.deploybot")
    }
}
