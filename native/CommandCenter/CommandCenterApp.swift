import AppKit
import SwiftUI

/// The Command Center menu-bar app. A status item shows a themed popover; the
/// settings window matches Sync Bar / Meeting Notifier. Non-sandboxed,
/// Developer ID, LSUIElement. The commandcenter:// router opens meeting links.
@main
struct CommandCenterApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    var body: some Scene {
        Settings {
            SettingsView()
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var statusItem: NSStatusItem?
    private let popover = NSPopover()
    private let routeHandler = RouteHandler()

    func applicationDidFinishLaunching(_ notification: Notification) {
        popover.behavior = .transient
        popover.contentSize = NSSize(width: 320, height: 220)
        popover.contentViewController = NSHostingController(
            rootView: MenuBarPopover(
                openSettings: { [weak self] in self?.openSettings() },
                quit: { NSApp.terminate(nil) }
            )
        )

        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        item.button?.image = NSImage(
            systemSymbolName: "rectangle.grid.2x2",
            accessibilityDescription: "Command Center"
        )
        item.button?.action = #selector(togglePopover)
        item.button?.target = self
        statusItem = item
    }

    func application(_ application: NSApplication, open urls: [URL]) {
        for url in urls {
            routeHandler.handle(url) { [weak self] in self?.openSettings() }
        }
    }

    @objc private func togglePopover() {
        guard let button = statusItem?.button else { return }
        if popover.isShown {
            popover.performClose(nil)
        } else {
            popover.show(relativeTo: button.bounds, of: button, preferredEdge: .minY)
            popover.contentViewController?.view.window?.makeKey()
        }
    }

    private func openSettings() {
        popover.performClose(nil)
        NSApp.activate(ignoringOtherApps: true)
        NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)
    }
}
