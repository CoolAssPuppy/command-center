import CommandCenterCore
import CommandCenterKit
import Foundation

/// A minimal example of a third-party Command Center provider. "DeployBot"
/// publishes a single metric card via the file-drop transport. This is the
/// reference a real app follows; see docs/15-building-a-provider.md. It publishes
/// only display data, never a token or secret.
public enum SampleProvider {
    public static let providerId = "com.example.deploybot"
    public static let displayName = "DeployBot"
    public static let bundleId = "com.example.deploybot"

    /// The default destination: the well-known directory Command Center scans.
    public static func defaultContainerURL() -> URL {
        FileDropTransport.wellKnownContainerURL()
    }

    /// Build the provider manifest. One feed (a generic card) at deploys.json.
    public static func manifest() -> JSONValue {
        let feedEntry: JSONValue = .object([
            "kind": .string("card"),
            "path": .string("deploys.json"),
        ])
        return .object([
            "schemaVersion": .number(1),
            "providerId": .string(providerId),
            "displayName": .string(displayName),
            "bundleId": .string(bundleId),
            "icon": .string("rocket"),
            "accentColorHex": .string("#16A34A"),
            "feeds": .array([feedEntry]),
        ])
    }

    /// Build a card feed: a glance plus one metric widget. Assembled from
    /// sub-expressions to keep the type checker fast.
    public static func feed() -> JSONValue {
        let glance: JSONValue = .object([
            "value": .string("2"),
            "label": .string("deploys today"),
            "tone": .string("positive"),
            "trend": .string("up"),
        ])
        let metric: JSONValue = .object([
            "type": .string("metric"),
            "data": .object([
                "value": .string("2"),
                "label": .string("today"),
                "tone": .string("positive"),
                "trend": .string("up"),
                "delta": .string("+1"),
            ]),
        ])
        let card: JSONValue = .object([
            "title": .string(displayName),
            "icon": .string("rocket"),
            "accentColorHex": .string("#16A34A"),
            "glance": glance,
            "widgets": .array([metric]),
        ])
        return .object([
            "schemaVersion": .number(1),
            "providerId": .string(providerId),
            "kind": .string("card"),
            "updatedAt": .string(ISO8601.formatter.string(from: Date())),
            "ttlSeconds": .number(300),
            "status": .string("ok"),
            "glance": glance,
            "data": .object(["card": card]),
        ])
    }

    /// Register and publish the demo feed into the given container.
    public static func publish(to containerURL: URL) async throws {
        let center = CommandCenter(
            providerId: providerId,
            displayName: displayName,
            bundleId: bundleId,
            transport: FileDropTransport(containerURL: containerURL)
        )
        try await center.register(manifest: manifest())
        try await center.publish(feed(), to: "deploys.json")
    }
}
