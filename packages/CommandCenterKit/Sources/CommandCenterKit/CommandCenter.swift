import CommandCenterCore
import Foundation

/// The provider-facing SDK. A third-party macOS app creates a CommandCenter for
/// its provider and publishes glanceable data; one API, two transports
/// underneath (file drop for Developer ID apps, the loopback endpoint for
/// sandboxed apps). The app keeps owning its own OAuth and tokens; it only
/// publishes finished display data. See docs/12-transports-and-ingest.md.
public struct CommandCenter {
    public let providerId: String
    public let displayName: String
    public let bundleId: String
    private let transport: IngestTransport

    public init(
        providerId: String,
        displayName: String,
        bundleId: String,
        transport: IngestTransport
    ) {
        self.providerId = providerId
        self.displayName = displayName
        self.bundleId = bundleId
        self.transport = transport
    }

    /// Register or refresh this provider, supplying its manifest.
    public func register(manifest: JSONValue) async throws {
        try await transport.register(
            providerId: providerId,
            bundleId: bundleId,
            displayName: displayName,
            manifest: manifest
        )
    }

    /// Publish a feed to a relative path inside the provider's folder.
    public func publish(_ feed: JSONValue, to path: String) async throws {
        try await transport.publish(providerId: providerId, feed: feed, to: path)
    }
}

/// What a transport must do. Injected, so the file-drop path is unit-tested with
/// a temp directory and the endpoint path with a stub socket.
public protocol IngestTransport {
    func register(
        providerId: String,
        bundleId: String,
        displayName: String,
        manifest: JSONValue
    ) async throws

    func publish(providerId: String, feed: JSONValue, to path: String) async throws
}

public enum CommandCenterKitError: Error, Equatable {
    case notApproved
    case refused(String)
}
