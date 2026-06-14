import Foundation

/// Reads providers and settings from a container directory laid out as in
/// docs/03-provider-contract.md:
///
///   <container>/Providers/<provider-id>/manifest.json
///   <container>/Providers/<provider-id>/<feed paths from the manifest>
///   <container>/CommandCenter/settings.json
///
/// The container URL is injected, so this is testable with a temp directory and
/// needs no App Group entitlement or signing. A provider whose app is not
/// installed is dropped; an unreadable or invalid feed is dropped without
/// failing the provider; a feed path that escapes the provider folder is
/// refused.
public struct FeedStore {
    private let containerURL: URL
    private let locator: ProviderLocator
    private let fileManager: FileManager

    public init(
        containerURL: URL,
        locator: ProviderLocator,
        fileManager: FileManager = .default
    ) {
        self.containerURL = containerURL
        self.locator = locator
        self.fileManager = fileManager
    }

    private var providersDirectory: URL {
        containerURL.appendingPathComponent("Providers", isDirectory: true)
    }

    /// All installed providers with their readable feeds.
    public func loadProviders() -> [ProviderEntry] {
        guard let entries = try? fileManager.contentsOfDirectory(
            at: providersDirectory,
            includingPropertiesForKeys: [.isDirectoryKey],
            options: [.skipsHiddenFiles]
        ) else {
            return []
        }

        var providers: [ProviderEntry] = []
        for directory in entries where isDirectory(directory) {
            guard let manifest = loadManifest(in: directory),
                  locator.isInstalled(bundleId: manifest.bundleId) else {
                continue
            }
            let feeds = loadFeeds(manifest: manifest, in: directory)
            providers.append(ProviderEntry(manifest: manifest, feeds: feeds))
        }
        return providers
    }

    /// The settings document, opaque to the native side and forwarded as-is.
    public func loadSettings() -> JSONValue? {
        let url = containerURL
            .appendingPathComponent("CommandCenter", isDirectory: true)
            .appendingPathComponent("settings.json")
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(JSONValue.self, from: data)
    }

    // MARK: - Private

    private func isDirectory(_ url: URL) -> Bool {
        (try? url.resourceValues(forKeys: [.isDirectoryKey]))?.isDirectory == true
    }

    private func loadManifest(in directory: URL) -> Manifest? {
        let url = directory.appendingPathComponent("manifest.json")
        guard let data = try? Data(contentsOf: url) else { return nil }
        return try? JSONDecoder().decode(Manifest.self, from: data)
    }

    private func loadFeeds(manifest: Manifest, in directory: URL) -> [FeedEnvelope] {
        var feeds: [FeedEnvelope] = []
        for feed in manifest.feeds {
            guard let path = feed.path,
                  let url = containedURL(base: directory, relativePath: path),
                  let data = try? Data(contentsOf: url) else {
                continue
            }
            if case .success(let envelope) = decodeFeedEnvelope(data) {
                feeds.append(envelope)
            }
        }
        return feeds
    }
}
