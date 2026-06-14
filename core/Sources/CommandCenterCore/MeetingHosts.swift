import Foundation

/// The single source of truth for recognized conferencing hosts. The calendar
/// mapper classifies a link's host into a platform, and the commandcenter://
/// router re-validates a join target's host against the same set. Keeping one
/// map here prevents the two from drifting on a security boundary.
public enum MeetingHosts {
    /// Base host -> platform name. A host matches if it equals a base or is a
    /// subdomain of one (so company.zoom.us classifies as zoom).
    public static let platformByBaseHost: [String: String] = [
        "meet.google.com": "meet",
        "zoom.us": "zoom",
        "zoom.com": "zoom",
        "teams.microsoft.com": "teams",
        "teams.live.com": "teams",
        "webex.com": "webex",
    ]

    public static func platform(forHost host: String?) -> String? {
        guard let host = host?.lowercased() else { return nil }
        for (base, platform) in platformByBaseHost where host == base || host.hasSuffix("." + base) {
            return platform
        }
        return nil
    }

    public static func isMeetingHost(_ host: String?) -> Bool {
        platform(forHost: host) != nil
    }
}
