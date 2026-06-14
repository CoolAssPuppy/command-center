import AppKit
import SwiftUI

/// The Command Center menu-bar app. For now it is a minimal shell that places a
/// status item; the settings window, the commandcenter:// URL router, and the
/// link opener arrive in later tasks (P2.5, P2.6). It is a menu-bar app
/// (LSUIElement), Developer ID, non-sandboxed.
@main
struct CommandCenterApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        Settings {
            EmptyView()
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private let routeHandler = RouteHandler()

    func applicationDidFinishLaunching(_ notification: Notification) {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.image = NSImage(
            systemSymbolName: "rectangle.grid.2x2",
            accessibilityDescription: "Command Center"
        )
        statusItem = item
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls {
            routeHandler.handle(url) { [weak self] in self?.openSettings() }
        }
    }

    private func openSettings() {
        NSApp.activate(ignoringOtherApps: true)
        NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
    }
}
