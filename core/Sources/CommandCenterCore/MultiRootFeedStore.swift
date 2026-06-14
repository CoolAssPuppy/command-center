import Foundation

/// Anything the dashboard composer can read providers and settings from. Both
/// FeedStore (one root) and MultiRootFeedStore (several roots) satisfy it.
public protocol ProviderSource {
    func loadProviders() -> [ProviderEntry]
    func loadSettings() -> JSONValue?
}

extension FeedStore: ProviderSource {}

/// Discovers providers across several container roots: the App Group container
/// for the first-party suite, and the well-known Application Support directory
/// the file-drop SDK writes to. Composed on FeedStore, so the scan, decode, and
/// installed-check logic lives in one place. Earlier roots take precedence on a
/// providerId collision, so a suite provider wins over a same-id file-drop one.
public struct MultiRootFeedStore: ProviderSource {
    private let stores: [FeedStore]

    public init(
        containerURLs: [URL],
        locator: ProviderLocator,
        fileManager: FileManager = .default
    ) {
        self.stores = containerURLs.map {
            FeedStore(containerURL: $0, locator: locator, fileManager: fileManager)
        }
    }

    public func loadProviders() -> [ProviderEntry] {
        var seen = Set<String>()
        var result: [ProviderEntry] = []
        for store in stores {
            for provider in store.loadProviders()
            where seen.insert(provider.manifest.providerId).inserted {
                result.append(provider)
            }
        }
        return result
    }

    public func loadSettings() -> JSONValue? {
        for store in stores {
            if let settings = store.loadSettings() { return settings }
        }
        return nil
    }
}
