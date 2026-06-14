import AppKit
import CommandCenterCore
import Foundation

/// Performs commandcenter:// routes. All parsing, validation, and the
/// browser-choice decision live in CommandCenterCore; this is the thin layer
/// that actually opens a URL with NSWorkspace. Only validated routes reach here,
/// so no unvalidated or dangerous URL is ever opened.
struct RouteHandler {
    /// Read the per-platform browser routing from the shared settings.
    private func currentRouting() -> [String: String] {
        let settings = FeedStore(
            containerURL: AppContainer.url(),
            locator: WorkspaceProviderLocator()
        ).loadSettings()
        return browserRouting(from: settings)
    }

    func handle(_ url: URL, openSettings: () -> Void) {
        guard let route = parseRoute(url) else { return }
        switch route {
        case .settings:
            openSettings()
        case let .join(target, platform):
            open(target, bundleId: resolveBrowserBundleId(platform: platform, routing: currentRouting()))
        case let .open(target):
            open(target, bundleId: nil)
        case let .openProvider(providerId, target):
            launchProvider(providerId: providerId, fallback: target)
        }
    }

    /// Launch the provider's own app (used by the reconnect prompt). The route
    /// carries a providerId but usually no url, so resolve the bundle id from
    /// the installed provider's manifest and launch it; fall back to the url.
    private func launchProvider(providerId: String, fallback: URL?) {
        if let bundleId = providerBundleId(providerId),
           let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleId) {
            NSWorkspace.shared.openApplication(at: appURL, configuration: NSWorkspace.OpenConfiguration())
        } else if let fallback {
            open(fallback, bundleId: nil)
        }
    }

    private func providerBundleId(_ providerId: String) -> String? {
        FeedStore(containerURL: AppContainer.url(), locator: WorkspaceProviderLocator())
            .loadProviders()
            .first { $0.manifest.providerId == providerId }?
            .manifest.bundleId
    }

    private func open(_ url: URL, bundleId: String?) {
        if let bundleId,
           let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleId) {
            let config = NSWorkspace.OpenConfiguration()
            NSWorkspace.shared.open([url], withApplicationAt: appURL, configuration: config)
        } else {
            NSWorkspace.shared.open(url)
        }
    }
}
