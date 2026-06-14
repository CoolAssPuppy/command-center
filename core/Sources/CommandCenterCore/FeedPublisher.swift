import Foundation

/// Writes a provider's manifest and feeds into the shared container, atomically,
/// under Providers/<providerId>/. Satellite apps use the same shape to publish.
/// Command Center uses it for its own Apple-calendar provider. See
/// docs/03-provider-contract.md and docs/09-satellite-integration.md.
public struct FeedPublisher {
    public let providerId: String
    private let containerURL: URL
    private let fileManager: FileManager

    public init(providerId: String, containerURL: URL, fileManager: FileManager = .default) {
        self.providerId = providerId
        self.containerURL = containerURL
        self.fileManager = fileManager
    }

    private var providerDirectory: URL {
        containerURL.appendingPathComponent("Providers/\(providerId)", isDirectory: true)
    }

    @discardableResult
    public func writeManifest(_ manifest: JSONValue) throws -> URL {
        try write(manifest, to: "manifest.json")
    }

    @discardableResult
    public func writeFeed(_ envelope: JSONValue, to relativePath: String) throws -> URL {
        try write(envelope, to: relativePath)
    }

    enum PublishError: Error { case pathEscapesProviderFolder }

    private func write(_ value: JSONValue, to relativePath: String) throws -> URL {
        // Refuse a path that escapes the provider folder, symmetric with the
        // read side in FeedStore.
        guard let url = containedURL(base: providerDirectory, relativePath: relativePath) else {
            throw PublishError.pathEscapesProviderFolder
        }
        try writeJSONAtomically(value, to: url, using: fileManager)
        return url
    }
}
