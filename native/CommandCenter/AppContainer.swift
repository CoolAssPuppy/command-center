import CommandCenterCore
import Foundation

/// Resolves the container the app reads/writes: the App Group container when the
/// entitlement is active, else a dev fallback in Application Support (unsigned
/// builds have no App Group). Shared by AppSettings and the providers model so
/// they always see the same data.
enum AppContainer {
    static func url() -> URL {
        if let group = CommandCenterContainer.url() { return group }
        let dir = CommandCenterContainer.applicationSupportBaseURL()
            .appendingPathComponent("CommandCenterDev", isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        return dir
    }
}
