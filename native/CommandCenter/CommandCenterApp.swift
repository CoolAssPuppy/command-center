import AppKit
import CommandCenterAuth
import SwiftUI

/// The Command Center container app. It exists so Safari has a signed host for
/// the extension and so Google sign-in has somewhere native to run. It is a
/// menu-bar app (LSUIElement, no Dock icon): the status item offers onboarding,
/// an update check, and quit, while an AuthEndpoint answers the extension's
/// sign-in requests over the loopback. Non-sandboxed, Developer ID, hardened
/// runtime.
@main
struct CommandCenterApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        // The onboarding window is the only scene; the app is otherwise the menu
        // bar item wired up in the delegate.
        Settings {
            OnboardingView()
        }
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private let popover = NSPopover()
    private var authEndpoint: AuthEndpoint?
    // Held so Sparkle starts checking at launch.
    private let updater = UpdaterManager.shared

    func applicationDidFinishLaunching(_ notification: Notification) {
        configureStatusItem()
        configurePopover()
        startAuthEndpoint()
    }

    private func configureStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.image = NSImage(
            systemSymbolName: "rectangle.grid.2x2",
            accessibilityDescription: "Command Center"
        )
        item.button?.action = #selector(togglePopover)
        item.button?.target = self
        statusItem = item
    }

    private func configurePopover() {
        popover.behavior = .transient
        popover.contentSize = NSSize(width: 340, height: 320)
        popover.contentViewController = NSHostingController(
            rootView: OnboardingView(
                checkForUpdates: { [weak self] in self?.updater.checkForUpdates() },
                quit: { NSApp.terminate(nil) }
            )
        )
    }

    /// Answer the extension's sign-in requests on the loopback. The endpoint is
    /// inert until the extension connects, so starting it at launch costs nothing.
    private func startAuthEndpoint() {
        let endpoint = AuthEndpoint(
            authService: GoogleAuthService(config: AppConfig.googleOAuth)
        )
        endpoint.start()
        authEndpoint = endpoint
    }

    @objc private func togglePopover() {
        guard let button = statusItem?.button else { return }
        if popover.isShown {
            popover.performClose(nil)
        } else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            popover.contentViewController?.view.window?.makeKey()
            NSApp.activate(ignoringOtherApps: true)
        }
    }
}
