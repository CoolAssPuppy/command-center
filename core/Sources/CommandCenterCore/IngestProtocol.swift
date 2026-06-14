import Foundation

/// The wire protocol for the loopback ingest endpoint, and a pure dispatcher.
/// The socket transport is a thin app-target wrapper; everything decidable lives
/// here and is unit-tested. A provider sends a register or publish request; the
/// dispatcher answers ok / pending / refused. A token is never echoed back in a
/// response. See docs/12-transports-and-ingest.md.

public enum IngestRequest: Equatable {
    case register(providerId: String, bundleId: String, displayName: String, manifest: JSONValue?)
    case publish(providerId: String, token: String, path: String, feed: JSONValue)
}

extension IngestRequest: Codable {
    private enum CodingKeys: String, CodingKey {
        case type, providerId, bundleId, displayName, manifest, token, path, feed
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        switch try container.decode(String.self, forKey: .type) {
        case "register":
            self = .register(
                providerId: try container.decode(String.self, forKey: .providerId),
                bundleId: try container.decode(String.self, forKey: .bundleId),
                displayName: try container.decode(String.self, forKey: .displayName),
                manifest: try container.decodeIfPresent(JSONValue.self, forKey: .manifest)
            )
        case "publish":
            self = .publish(
                providerId: try container.decode(String.self, forKey: .providerId),
                token: try container.decode(String.self, forKey: .token),
                path: try container.decode(String.self, forKey: .path),
                feed: try container.decode(JSONValue.self, forKey: .feed)
            )
        case let other:
            throw DecodingError.dataCorruptedError(
                forKey: .type, in: container, debugDescription: "unknown request type \(other)"
            )
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case let .register(providerId, bundleId, displayName, manifest):
            try container.encode("register", forKey: .type)
            try container.encode(providerId, forKey: .providerId)
            try container.encode(bundleId, forKey: .bundleId)
            try container.encode(displayName, forKey: .displayName)
            try container.encodeIfPresent(manifest, forKey: .manifest)
        case let .publish(providerId, token, path, feed):
            try container.encode("publish", forKey: .type)
            try container.encode(providerId, forKey: .providerId)
            try container.encode(token, forKey: .token)
            try container.encode(path, forKey: .path)
            try container.encode(feed, forKey: .feed)
        }
    }
}

public struct IngestResponse: Codable, Equatable {
    public let ok: Bool
    public let status: String?
    public let error: String?

    public init(ok: Bool, status: String?, error: String?) {
        self.ok = ok
        self.status = status
        self.error = error
    }

    static func accepted() -> IngestResponse { IngestResponse(ok: true, status: nil, error: nil) }
    static func registered(_ status: String) -> IngestResponse {
        IngestResponse(ok: true, status: status, error: nil)
    }
    static func refused(_ error: String) -> IngestResponse {
        IngestResponse(ok: false, status: nil, error: error)
    }
}

/// Decode a request, dispatch it to the IngestHandler, and encode a response.
/// Pure and synchronous: the transport just moves bytes. Token delivery after
/// approval is the providers screen's concern, not a response field here.
public func handleIngestMessage(_ requestData: Data, using handler: IngestHandler) -> Data {
    let response = makeResponse(requestData, using: handler)
    return (try? JSONEncoder().encode(response))
        ?? Data(#"{"ok":false,"error":"encode_failed"}"#.utf8)
}

private func makeResponse(_ requestData: Data, using handler: IngestHandler) -> IngestResponse {
    guard let request = try? JSONDecoder().decode(IngestRequest.self, from: requestData) else {
        return .refused("invalid_request")
    }
    switch request {
    case let .register(providerId, bundleId, displayName, manifest):
        do {
            let registration = try handler.register(
                providerId: providerId, bundleId: bundleId,
                displayName: displayName, manifest: manifest
            )
            return .registered(registration.consent.rawValue)
        } catch {
            return .refused("registration_failed")
        }
    case let .publish(providerId, token, path, feed):
        if let error = handler.publish(providerId: providerId, token: token, feed: feed, to: path) {
            return .refused(error.code)
        }
        return .accepted()
    }
}
