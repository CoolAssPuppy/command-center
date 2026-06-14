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
}
