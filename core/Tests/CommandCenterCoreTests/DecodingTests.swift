import XCTest
@testable import CommandCenterCore

final class DecodingTests: XCTestCase {
    private func data(_ json: String) -> Data { Data(json.utf8) }

    private let validFeed = """
    {
      "schemaVersion": 1,
      "providerId": "linear-bar",
      "kind": "linear.inbox",
      "updatedAt": "2026-06-14T15:04:05Z",
      "ttlSeconds": 300,
      "status": "needs_auth",
      "glance": { "value": "3", "label": "unread", "tone": "urgent" },
      "data": { "items": [ { "id": "n1", "url": "https://x" } ] }
    }
    """

    func testDecodesAValidFeedAndMapsStatus() {
        let result = decodeFeedEnvelope(data(validFeed))
        guard case .success(let feed) = result else {
            return XCTFail("expected success, got \(result)")
        }
        XCTAssertEqual(feed.providerId, "linear-bar")
        XCTAssertEqual(feed.status, .needsAuth)
        XCTAssertEqual(feed.glance.value, "3")
        XCTAssertEqual(feed.glance.tone, .urgent)
    }

    func testPreservesOpaqueDataAsJsonValue() {
        guard case .success(let feed) = decodeFeedEnvelope(data(validFeed)),
              let object = feed.data?.objectValue,
              let items = object["items"]?.arrayValue else {
            return XCTFail("expected data to round-trip as JSON")
        }
        XCTAssertEqual(items.count, 1)
    }

    func testRefusesAFutureSchemaVersion() {
        let json = validFeed.replacingOccurrences(of: "\"schemaVersion\": 1", with: "\"schemaVersion\": 2")
        XCTAssertEqual(decodeFeedEnvelope(data(json)), .failure(.unsupportedSchemaVersion(2)))
    }

    func testRejectsAnEmptyGlanceValue() {
        let json = validFeed.replacingOccurrences(of: "\"value\": \"3\"", with: "\"value\": \"\"")
        XCTAssertEqual(decodeFeedEnvelope(data(json)), .failure(.invalidGlance))
    }

    func testReportsMalformedJson() {
        if case .failure(.malformed) = decodeFeedEnvelope(data("{ not json")) {
            return
        }
        XCTFail("expected a malformed failure")
    }
}
