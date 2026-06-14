import CommandCenterCore
import Foundation

/// The file-drop transport: write the manifest and feeds straight into the
/// well-known directory, reusing CommandCenterCore's FeedPublisher (single
/// source of truth for the on-disk layout and the path-traversal guard). For
/// non-sandboxed Developer ID apps. No network, no token.
public struct FileDropTransport: IngestTransport {
    private let containerURL: URL
    private let fileManager: FileManager

    public init(containerURL: URL, fileManager: FileManager = .default) {
        self.containerURL = containerURL
        self.fileManager = fileManager
    }

    /// The default well-known container, defined once in CommandCenterCore so the
    /// SDK and the app agree on the path.
    public static func wellKnownContainerURL(fileManager: FileManager = .default) -> URL {
        CommandCenterContainer.wellKnownDirectoryURL(fileManager: fileManager)
    }

    private func publisher(for providerId: String) -> FeedPublisher {
        FeedPublisher(providerId: providerId, containerURL: containerURL, fileManager: fileManager)
    }

    public func register(
        providerId: String,
        bundleId _: String,
        displayName _: String,
        manifest: JSONValue
    ) async throws {
        try publisher(for: providerId).writeManifest(manifest)
    }

    public func publish(providerId: String, feed: JSONValue, to path: String) async throws {
        try publisher(for: providerId).writeFeed(feed, to: path)
    }
}
