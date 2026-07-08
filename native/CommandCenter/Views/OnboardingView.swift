import AppKit
import SwiftUI

/// The menu-bar popover. Its whole job is to get a first-run user over the two
/// Safari-only humps: enabling the extension in Safari Settings, and knowing that
/// Google sign-in happens here in the app. Everything else (the dashboard) lives
/// in the new tab page, so this stays deliberately small.
struct OnboardingView: View {
    var checkForUpdates: () -> Void = {}
    var quit: () -> Void = {}

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            header

            Step(number: 1, title: "Turn on the extension") {
                Text("Open Safari Settings → Extensions and switch on Command Center.")
                Button("Open Safari Extension Settings", action: openSafariExtensions)
                    .buttonStyle(.borderedProminent)
            }

            Step(number: 2, title: "Open a new tab") {
                Text("Your dashboard replaces the new tab page. Connect Notion, Linear, "
                    + "GitHub, Todoist, and Google right from there.")
            }

            Step(number: 3, title: "Google sign-in runs here") {
                Text("When you connect a Google account, this app handles sign-in and keeps "
                    + "the token in your Keychain. The browser never sees it.")
            }

            Divider()

            HStack {
                Button("Check for Updates…", action: checkForUpdates)
                Spacer()
                Button("Quit", action: quit)
            }
            .controlSize(.small)
        }
        .padding(20)
        .frame(width: 340)
    }

    private var header: some View {
        HStack(spacing: 10) {
            Image(systemName: "rectangle.grid.2x2")
                .font(.title2)
                .foregroundStyle(.tint)
            Text("Command Center")
                .font(.headline)
        }
    }

    /// Deep-link straight to Safari's Extensions pane so the user does not have to
    /// hunt for it. The app cannot toggle the extension for them (only the user
    /// can), so landing them on the exact screen is the most we can do.
    private func openSafariExtensions() {
        guard let url = URL(string: "x-apple.systempreferences:com.apple.Safari-Settings.extension") else {
            return
        }
        NSWorkspace.shared.open(url)
    }
}

/// A numbered onboarding row: a filled index bubble beside a titled block of
/// explanatory content.
private struct Step<Content: View>: View {
    let number: Int
    let title: String
    @ViewBuilder let content: () -> Content

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(number)")
                .font(.subheadline.weight(.semibold))
                .frame(width: 24, height: 24)
                .background(Circle().fill(.tint.opacity(0.15)))
            VStack(alignment: .leading, spacing: 6) {
                Text(title).font(.subheadline.weight(.semibold))
                content()
                    .font(.callout)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
