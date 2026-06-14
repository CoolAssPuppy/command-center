import Foundation

/// A provider's endpoint registration. Consent gates publishing: a provider can
/// only publish once the user has approved it. The capability token is never
/// stored in the clear; only its SHA-256 hash is persisted, so reading the
/// registrations file does not yield a usable token. See docs/12-transports-and-ingest.md.
public struct ProviderRegistration: Codable, Equatable {
    public enum Consent: String, Codable, Equatable {
        case pending, approved, denied
    }

    public let providerId: String
    public var bundleId: String
    public var displayName: String
    public var consent: Consent
    /// SHA-256 hex of the capability token. Present only while approved.
    public var tokenHash: String?
    /// The provider's manifest, written to the container on approval.
    public var manifest: JSONValue?
}

/// Persists provider registrations to CommandCenter/registrations.json in the
/// container. Loads on init, writes atomically on every mutation, so consent and
/// token hashes survive restarts.
public final class RegistrationStore {
    private let fileURL: URL
    private let fileManager: FileManager
    private var records: [String: ProviderRegistration]

    public init(containerURL: URL, fileManager: FileManager = .default) {
        self.fileManager = fileManager
        self.fileURL = containerURL
            .appendingPathComponent("CommandCenter", isDirectory: true)
            .appendingPathComponent("registrations.json")

        if let data = try? Data(contentsOf: fileURL),
           let decoded = try? JSONDecoder().decode([String: ProviderRegistration].self, from: data) {
            records = decoded
        } else {
            records = [:]
        }
    }

    public func all() -> [ProviderRegistration] {
        Array(records.values)
    }

    public func registration(forProviderId providerId: String) -> ProviderRegistration? {
        records[providerId]
    }

    public func upsert(_ registration: ProviderRegistration) throws {
        records[registration.providerId] = registration
        try persist()
    }

    public func remove(providerId: String) throws {
        records[providerId] = nil
        try persist()
    }

    private func persist() throws {
        try writeJSONAtomically(records, to: fileURL, using: fileManager)
    }
}
