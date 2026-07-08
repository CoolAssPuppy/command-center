import Combine
import Foundation
import Sparkle

/// Wraps Sparkle's standard updater so the menu bar can trigger a check and the
/// app auto-checks daily. Mirrors the agent-server UpdaterManager: a @MainActor
/// singleton owning an SPUStandardUpdaterController started at launch. The feed
/// URL and public Ed key live in Info.plist (SUFeedURL / SUPublicEDKey).
@MainActor
final class UpdaterManager: NSObject, ObservableObject {
    static let shared = UpdaterManager()

    private let controller: SPUStandardUpdaterController

    @Published var canCheckForUpdates = false

    private override init() {
        controller = SPUStandardUpdaterController(
            startingUpdater: true,
            updaterDelegate: nil,
            userDriverDelegate: nil
        )
        super.init()
        controller.updater.publisher(for: \.canCheckForUpdates)
            .assign(to: &$canCheckForUpdates)
    }

    func checkForUpdates() {
        controller.checkForUpdates(nil)
    }

    var automaticallyChecksForUpdates: Bool {
        get { controller.updater.automaticallyChecksForUpdates }
        set { controller.updater.automaticallyChecksForUpdates = newValue }
    }
}
