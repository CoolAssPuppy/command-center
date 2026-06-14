import CommandCenterCore
import XCTest
@testable import CommandCenterKit

/// Captures the request bytes and returns a canned response, so the transport's
/// encoding is verified without a real socket.
private final class StubSocketClient: IngestSocketClient {
    var lastRequest: Data?
    var response: IngestResponse

    init(response: IngestResponse) { self.response = response }

    func send(_ request: Data) async throws -> Data {
        lastRequest = request
        return try JSONEncoder().encode(response)
    }
}

final class EndpointTransportTests: XCTestCase {
    private let feed = JSONValue.object([
        "schemaVersion": .number(1), "providerId": .string("acme"), "kind": .string("linear.inbox"),
        "updatedAt": .string("2026-06-14T15:04:05Z"), "status": .string("ok"),
        "glance": .object(["value": .string("5"), "label": .string("unread")]),
        "data": .object(["items": .array([])]),
    ])

    private func decodeRequest(_ data: Data?) throws -> IngestRequest {
        try JSONDecoder().decode(IngestRequest.self, from: XCTUnwrap(data))
    }

    func testRegisterEncodesARegisterRequest() async throws {
        let stub = StubSocketClient(response: IngestResponse(ok: true, status: "pending", error: nil))
        let transport = EndpointTransport(client: stub, tokenStore: InMemoryTokenStore())

        try await transport.register(
            providerId: "acme", bundleId: "com.acme.app", displayName: "Acme",
            manifest: .object(["providerId": .string("acme")])
        )

        let request = try decodeRequest(stub.lastRequest)
        guard case let .register(providerId, bundleId, displayName, _) = request else {
            return XCTFail("expected a register request")
        }
        XCTAssertEqual([providerId, bundleId, displayName], ["acme", "com.acme.app", "Acme"])
    }

    func testPublishEncodesTheStoredToken() async throws {
        let stub = StubSocketClient(response: IngestResponse(ok: true, status: nil, error: nil))
        let store = InMemoryTokenStore()
        store.setToken("secret-token", forProviderId: "acme")
        let transport = EndpointTransport(client: stub, tokenStore: store)

        try await transport.publish(providerId: "acme", feed: feed, to: "feed.json")

        guard case let .publish(_, token, path, _) = try decodeRequest(stub.lastRequest) else {
            return XCTFail("expected a publish request")
        }
        XCTAssertEqual(token, "secret-token")
        XCTAssertEqual(path, "feed.json")
    }

    func testPublishWithoutATokenThrowsNotApproved() async {
        let stub = StubSocketClient(response: IngestResponse(ok: true, status: nil, error: nil))
        let transport = EndpointTransport(client: stub, tokenStore: InMemoryTokenStore())

        await assertThrows(CommandCenterKitError.notApproved) {
            try await transport.publish(providerId: "acme", feed: self.feed, to: "feed.json")
        }
    }

    func testPublishSurfacesARefusedResponse() async {
        let stub = StubSocketClient(response: IngestResponse(ok: false, status: nil, error: "invalid_token"))
        let store = InMemoryTokenStore()
        store.setToken("t", forProviderId: "acme")
        let transport = EndpointTransport(client: stub, tokenStore: store)

        await assertThrows(CommandCenterKitError.refused("invalid_token")) {
            try await transport.publish(providerId: "acme", feed: self.feed, to: "feed.json")
        }
    }

    private func assertThrows(
        _ expected: CommandCenterKitError,
        _ body: () async throws -> Void
    ) async {
        do {
            try await body()
            XCTFail("expected \(expected)")
        } catch let error as CommandCenterKitError {
            XCTAssertEqual(error, expected)
        } catch {
            XCTFail("unexpected error \(error)")
        }
    }
}
