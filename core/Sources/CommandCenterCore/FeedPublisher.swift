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

    private func write(_ value: JSONValue, to relativePath: String) throws -> URL {
        let url = providerDirectory.appendingPathComponent(relativePath)
        try fileManager.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        let data = try JSONEncoder().encode(value)
        try data.write(to: url, options: .atomic)
        return url
    }
}
