import Foundation

/// The shared App Group container for the Strategic Nerds suite. Command Center
/// reads providers and settings from here; satellite apps publish into it. The
/// group id is the same across the suite, which is what makes sharing legal.
/// See docs/03-provider-contract.md.
public enum CommandCenterContainer {
    public static let groupId = "group.com.strategicnerds.suite"

    /// The on-disk container URL, or nil if the App Group entitlement is not
    /// active (for example in an unsigned dev build).
    public static func url(fileManager: FileManager = .default) -> URL? {
        fileManager.containerURL(forSecurityApplicationGroupIdentifier: groupId)
    }

    /// The Application Support base directory (or a temp fallback). Single source
    /// for the derivation reused by the well-known directory and the app's dev
    /// container fallback.
    public static func applicationSupportBaseURL(fileManager: FileManager = .default) -> URL {
        fileManager
            .urls(for: .applicationSupportDirectory, in: .userDomainMask)
            .first ?? fileManager.temporaryDirectory
    }

    /// The well-known directory the file-drop transport writes to, for open
    /// (non-suite) providers. Single source of truth for both the SDK and the
    /// app's discovery. See docs/12-transports-and-ingest.md.
    public static func wellKnownDirectoryURL(fileManager: FileManager = .default) -> URL {
        applicationSupportBaseURL(fileManager: fileManager)
            .appendingPathComponent("Command Center", isDirectory: true)
    }
}
