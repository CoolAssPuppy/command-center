import Foundation

/// The contract models, mirroring docs/03-provider-contract.md and the
/// dashboard's TypeScript schemas. The native side validates the envelope, the
/// manifest, and the payload; widget shape inside `data` stays the dashboard's
/// responsibility.

public enum Tone: String, Codable, Equatable {
    case neutral, positive, urgent
}

public enum Trend: String, Codable, Equatable {
    case up, down, flat
}

public enum FeedStatus: String, Codable, Equatable {
    case ok
    case stale
    case needsAuth = "needs_auth"
    case error
    case disabled
}

public struct Glance: Codable, Equatable {
    public let value: String
    public let label: String
    public let tone: Tone?
    public let trend: Trend?
}

public struct ManifestAction: Codable, Equatable {
    public let id: String
    public let title: String?
    public let urlTemplate: String?
    public let route: String?
}

public struct ManifestFeed: Codable, Equatable {
    public let kind: String
    public let path: String?
    public let refreshIntervalSeconds: Int?
    public let title: String?
}

public struct Manifest: Codable, Equatable {
    public let schemaVersion: Int
    public let providerId: String
    public let displayName: String
    public let bundleId: String
    public let appVersion: String?
    public let icon: String?
    public let accentColorHex: String?
    public let updatedAt: String?
    public let feeds: [ManifestFeed]
    public let actions: [ManifestAction]?
}

public struct ProducedBy: Codable, Equatable {
    public let bundleId: String
    public let appVersion: String
}

public struct FeedEnvelope: Codable, Equatable {
    public let schemaVersion: Int
    public let providerId: String
    public let kind: String
    public let producedBy: ProducedBy?
    public let updatedAt: String
    public let ttlSeconds: Int?
    public let status: FeedStatus
    public let glance: Glance
    public let data: JSONValue?
}

public struct ProviderEntry: Codable, Equatable {
    public let manifest: Manifest
    public let feeds: [FeedEnvelope]
}

public struct DashboardPayload: Codable, Equatable {
    public let settings: JSONValue?
    public let providers: [ProviderEntry]
    public let generatedAt: String?
}
