import XCTest
@testable import CommandCenterCore

final class IngestHandlerTests: XCTestCase {
    private var container: URL!

    override func setUpWithError() throws {
        container = try makeTempContainer()
    }

    private func handler() -> IngestHandler {
        IngestHandler(containerURL: container)
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
        "glance": .object(["value": .string("3"), "label": .string("unread")]),
        "data": .object(["items": .array([])]),
    ])

    private func register() throws {
        try handler().register(providerId: "acme", bundleId: "com.acme.app", displayName: "Acme", manifest: manifest)
    }

    func testRegistrationStartsPendingWithNoToken() throws {
        let registration = try handler().register(
            providerId: "acme", bundleId: "com.acme.app", displayName: "Acme"
        )
        XCTAssertEqual(registration.consent, .pending)
        XCTAssertNil(registration.tokenHash)
    }

    func testRegistrationIsIdempotent() throws {
        try register()
        try register()
        XCTAssertEqual(RegistrationStore(containerURL: container).all().count, 1)
    }

    func testPublishBeforeApprovalIsRefused() throws {
        try register()
        let result = handler().publish(providerId: "acme", token: "anything", feed: feed, to: "feed.json")
        XCTAssertEqual(result, .notApproved)
    }

    func testApprovedPublishWithTheTokenWritesAFeedStoreReadableFeed() throws {
        try register()
        guard let token = try handler().approve(providerId: "acme") else {
            return XCTFail("approve should return a token")
        }

        let result = handler().publish(providerId: "acme", token: token, feed: feed, to: "feed.json")
        XCTAssertNil(result)

        let providers = FeedStore(containerURL: container, locator: StubLocator(installed: ["com.acme.app"]))
            .loadProviders()
        XCTAssertEqual(providers.first?.feeds.first?.glance.value, "3")
    }

    func testPublishWithTheWrongTokenIsRefused() throws {
        try register()
        _ = try handler().approve(providerId: "acme")
        let result = handler().publish(providerId: "acme", token: "wrong", feed: feed, to: "feed.json")
        XCTAssertEqual(result, .invalidToken)
    }

    func testPublishForAnUnknownProviderIsRefused() {
        let result = handler().publish(providerId: "ghost", token: "x", feed: feed, to: "feed.json")
        XCTAssertEqual(result, .unknownProvider)
    }

    func testRevokedProviderCannotPublish() throws {
        try register()
        let token = try handler().approve(providerId: "acme")
        try handler().revoke(providerId: "acme")
        let result = handler().publish(providerId: "acme", token: token ?? "", feed: feed, to: "feed.json")
        XCTAssertEqual(result, .unknownProvider)
    }

    func testDeniedProviderCannotPublish() throws {
        try register()
        _ = try handler().approve(providerId: "acme")
        try handler().deny(providerId: "acme")
        let result = handler().publish(providerId: "acme", token: "x", feed: feed, to: "feed.json")
        XCTAssertEqual(result, .denied)
    }

    func testTokenSurvivesRestartAndIsNotStoredInClear() throws {
        try register()
        guard let token = try handler().approve(providerId: "acme") else {
            return XCTFail("approve should return a token")
        }

        // A fresh handler (simulating a restart) accepts the same token.
        let restarted = IngestHandler(containerURL: container)
        XCTAssertNil(restarted.publish(providerId: "acme", token: token, feed: feed, to: "feed.json"))

        // The raw token never appears in the persisted file.
        let registrationsFile = container
            .appendingPathComponent("CommandCenter/registrations.json")
        let contents = try String(contentsOf: registrationsFile, encoding: .utf8)
        XCTAssertFalse(contents.contains(token), "raw token must not be persisted")
    }
}
