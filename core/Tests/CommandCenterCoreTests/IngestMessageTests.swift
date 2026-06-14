import XCTest
@testable import CommandCenterCore

final class IngestMessageTests: XCTestCase {
    private var container: URL!

    override func setUpWithError() throws {
        container = try makeTempContainer()
    }

    private func handler() -> IngestHandler { IngestHandler(containerURL: container) }

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
        "glance": .object(["value": .string("3"), "label": .string("unread")]),
        "data": .object(["items": .array([])]),
    ])

    private func dispatch(_ request: IngestRequest, _ handler: IngestHandler) throws -> IngestResponse {
        let data = try JSONEncoder().encode(request)
        return try JSONDecoder().decode(IngestResponse.self, from: handleIngestMessage(data, using: handler))
    }

    func testRegisterRequestReturnsPending() throws {
        let response = try dispatch(
            .register(providerId: "acme", bundleId: "com.acme.app", displayName: "Acme", manifest: manifest),
            handler()
        )
        XCTAssertTrue(response.ok)
        XCTAssertEqual(response.status, "pending")
    }

    func testMalformedRequestIsRefused() throws {
        let response = try JSONDecoder().decode(
            IngestResponse.self,
            from: handleIngestMessage(Data("{ not json".utf8), using: handler())
        )
        XCTAssertFalse(response.ok)
        XCTAssertEqual(response.error, "invalid_request")
    }

    func testUnknownTypeIsRefused() throws {
        let response = try JSONDecoder().decode(
            IngestResponse.self,
            from: handleIngestMessage(Data(#"{"type":"destroy"}"#.utf8), using: handler())
        )
        XCTAssertFalse(response.ok)
    }

    func testPublishBeforeApprovalIsRefusedWithACode() throws {
        let h = handler()
        _ = try dispatch(.register(providerId: "acme", bundleId: "com.acme.app", displayName: "Acme", manifest: manifest), h)

        let response = try dispatch(.publish(providerId: "acme", token: "x", path: "feed.json", feed: feed), h)
        XCTAssertFalse(response.ok)
        XCTAssertEqual(response.error, "not_approved")
    }

    func testApprovedPublishOverTheProtocolWritesAReadableFeed() throws {
        let h = handler()
        _ = try dispatch(.register(providerId: "acme", bundleId: "com.acme.app", displayName: "Acme", manifest: manifest), h)
        guard let token = try h.approve(providerId: "acme") else { return XCTFail("token") }

        let response = try dispatch(.publish(providerId: "acme", token: token, path: "feed.json", feed: feed), h)
        XCTAssertTrue(response.ok)

        let providers = FeedStore(containerURL: container, locator: StubLocator(installed: ["com.acme.app"]))
            .loadProviders()
        XCTAssertEqual(providers.first?.feeds.first?.glance.value, "3")
    }

    func testResponseNeverEchoesAToken() throws {
        let h = handler()
        _ = try dispatch(.register(providerId: "acme", bundleId: "com.acme.app", displayName: "Acme", manifest: manifest), h)
        guard let token = try h.approve(providerId: "acme") else { return XCTFail("token") }

        let data = try JSONEncoder().encode(IngestRequest.publish(providerId: "acme", token: token, path: "feed.json", feed: feed))
        let responseData = handleIngestMessage(data, using: h)
        let responseString = String(decoding: responseData, as: UTF8.self)
        XCTAssertFalse(responseString.contains(token), "a response must never echo a token")
    }
}
