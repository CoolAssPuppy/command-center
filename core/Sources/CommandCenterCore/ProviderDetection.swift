import Foundation

#if canImport(AppKit)
import AppKit
#endif

/// Whether a provider's owning app is actually installed. Injected so it is
/// testable without touching the real system, and so a provider whose app was
/// removed but left files behind is ignored. Mirrors the NSWorkspace check both
/// Linear Bar and Meeting Notifier already use.
public protocol ProviderLocator {
    func isInstalled(bundleId: String) -> Bool
}

#if canImport(AppKit)
public struct WorkspaceProviderLocator: ProviderLocator {
    public init() {}

    public func isInstalled(bundleId: String) -> Bool {
        NSWorkspace.shared.urlForApplication(withBundleIdentifier: bundleId) != nil
    }
}
#endif

/// Keep only the providers whose owning app is installed.
public func installedProviders(
    in payload: DashboardPayload,
    using locator: ProviderLocator
) -> [ProviderEntry] {
    payload.providers.filter { locator.isInstalled(bundleId: $0.manifest.bundleId) }
}
