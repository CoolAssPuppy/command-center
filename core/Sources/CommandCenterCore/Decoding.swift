import Foundation

/// The contract version this build understands. A feed from a newer version is
/// refused, never half-rendered. Mirrors CURRENT_SCHEMA_VERSION in the dashboard.
public let currentSchemaVersion = 1

public enum FeedDecodeError: Error, Equatable {
    case malformed(String)
    case unsupportedSchemaVersion(Int)
    case invalidGlance
}

/// Decode and validate a single feed envelope: well-formed JSON, a schema
/// version this build understands, and a non-empty glance.
public func decodeFeedEnvelope(_ data: Data) -> Result<FeedEnvelope, FeedDecodeError> {
    let envelope: FeedEnvelope
    do {
        envelope = try JSONDecoder().decode(FeedEnvelope.self, from: data)
    } catch {
        return .failure(.malformed(String(describing: error)))
    }
    if envelope.schemaVersion > currentSchemaVersion {
        return .failure(.unsupportedSchemaVersion(envelope.schemaVersion))
    }
    if envelope.glance.value.isEmpty {
        return .failure(.invalidGlance)
    }
    return .success(envelope)
}

/// Decode a getDashboard payload. Per-feed schema and glance validation happens
/// when the FeedStore processes each feed; this only checks the outer shape.
public func decodeDashboardPayload(_ data: Data) -> Result<DashboardPayload, FeedDecodeError> {
    do {
        return .success(try JSONDecoder().decode(DashboardPayload.self, from: data))
    } catch {
        return .failure(.malformed(String(describing: error)))
    }
}
