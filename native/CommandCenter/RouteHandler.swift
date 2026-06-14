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
        guard let container = CommandCenterContainer.url() else { return [:] }
        let settings = FeedStore(
            containerURL: container,
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
        case let .openProvider(_, target):
            if let target { open(target, bundleId: nil) }
        }
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
