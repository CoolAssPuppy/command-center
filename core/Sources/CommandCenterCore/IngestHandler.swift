import CryptoKit
import Foundation

/// Processes endpoint ingest operations against the registration store and the
/// feed publisher. Pure logic, no sockets: the loopback transport calls these.
/// Publishing requires an approved provider and a matching capability token; a
/// pending, denied, unknown, or wrong-token provider is refused. Tokens are
/// capability secrets and are never logged.
public struct IngestHandler {
    private let store: RegistrationStore
    private let containerURL: URL
    private let fileManager: FileManager

    public init(containerURL: URL, fileManager: FileManager = .default) {
        self.containerURL = containerURL
        self.fileManager = fileManager
        self.store = RegistrationStore(containerURL: containerURL, fileManager: fileManager)
    }

    public enum IngestError: Error, Equatable {
        case unknownProvider
        case notApproved
        case denied
        case invalidToken
        case writeFailed(String)

        /// A stable wire code returned to the provider in a refused response.
        public var code: String {
            switch self {
            case .unknownProvider: return "unknown_provider"
            case .notApproved: return "not_approved"
            case .denied: return "denied"
            case .invalidToken: return "invalid_token"
            case .writeFailed: return "write_failed"
            }
        }
    }

    /// Register or refresh a provider. New providers start pending (no token
    /// until the user approves). Idempotent: re-registering keeps the consent
    /// state and token hash, refreshing only the metadata and manifest.
    @discardableResult
    public func register(
        providerId: String,
        bundleId: String,
        displayName: String,
        manifest: JSONValue? = nil
    ) throws -> ProviderRegistration {
        if var existing = store.registration(forProviderId: providerId) {
            existing.bundleId = bundleId
            existing.displayName = displayName
            if let manifest { existing.manifest = manifest }
            try store.upsert(existing)
            return existing
        }
        let registration = ProviderRegistration(
            providerId: providerId,
            bundleId: bundleId,
            displayName: displayName,
            consent: .pending,
            tokenHash: nil,
            manifest: manifest
        )
        try store.upsert(registration)
        return registration
    }

    /// Approve a provider. Issues a fresh capability token (returned ONCE to the
    /// caller to hand to the provider), persists only its hash, and writes the
    /// provider's manifest so the dashboard can discover it. Returns nil if the
    /// provider was never registered.
    public func approve(providerId: String) throws -> String? {
        guard var registration = store.registration(forProviderId: providerId) else { return nil }
        let token = Self.generateToken()
        registration.consent = .approved
        registration.tokenHash = Self.hash(token)
        try store.upsert(registration)
        if let manifest = registration.manifest {
            try FeedPublisher(providerId: providerId, containerURL: containerURL, fileManager: fileManager)
                .writeManifest(manifest)
        }
        return token
    }

    public func deny(providerId: String) throws {
        guard var registration = store.registration(forProviderId: providerId) else { return }
        registration.consent = .denied
        registration.tokenHash = nil
        try store.upsert(registration)
    }

    public func revoke(providerId: String) throws {
        try store.remove(providerId: providerId)
    }

    /// Publish a feed. Returns nil on success, or the reason it was refused.
    /// Refused unless the provider is approved and the token matches the stored
    /// hash.
    public func publish(
        providerId: String,
        token: String,
        feed: JSONValue,
        to relativePath: String
    ) -> IngestError? {
        guard let registration = store.registration(forProviderId: providerId) else {
            return .unknownProvider
        }
        if registration.consent == .denied { return .denied }
        guard registration.consent == .approved else { return .notApproved }
        guard let tokenHash = registration.tokenHash,
              constantTimeEquals(tokenHash, Self.hash(token)) else {
            return .invalidToken
        }
        do {
            try FeedPublisher(providerId: providerId, containerURL: containerURL, fileManager: fileManager)
                .writeFeed(feed, to: relativePath)
            return nil
        } catch {
            return .writeFailed(String(describing: error))
        }
    }

    // MARK: - Tokens

    static func generateToken() -> String {
        var bytes = [UInt8](repeating: 0, count: 32)
        for index in bytes.indices { bytes[index] = UInt8.random(in: 0...255) }
        return bytes.map { String(format: "%02x", $0) }.joined()
    }

    static func hash(_ token: String) -> String {
        SHA256.hash(data: Data(token.utf8)).map { String(format: "%02x", $0) }.joined()
    }
}

/// Length-then-content comparison that does not short-circuit on the first
/// differing byte, so token validation does not leak via timing.
private func constantTimeEquals(_ lhs: String, _ rhs: String) -> Bool {
    let a = Array(lhs.utf8)
    let b = Array(rhs.utf8)
    guard a.count == b.count else { return false }
    var difference: UInt8 = 0
    for index in a.indices { difference |= a[index] ^ b[index] }
    return difference == 0
}
