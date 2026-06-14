import Foundation

/// Parsing, validation, and browser-routing decisions for commandcenter:// URLs.
/// The dashboard never opens a URL itself; it navigates to a commandcenter://
/// action and the native app validates and opens. This re-validates on the
/// native side (defense in depth): dangerous schemes are always refused, join
/// targets must be https meeting hosts, and an embedded url can never smuggle a
/// dangerous scheme. See docs/05-native-app.md and docs/10-security.md.

public let commandCenterScheme = "commandcenter"

/// Keep in sync with the `platform` enum in dashboard/src/domain/kinds.ts: the
/// dashboard publishes these raw values and this layer routes on them.
public enum MeetingPlatform: String, Equatable {
    case meet, zoom, teams, webex, other
}

public enum CommandCenterRoute: Equatable {
    case join(url: URL, platform: MeetingPlatform?)
    case open(url: URL)
    case openProvider(providerId: String, url: URL?)
    case settings
}

/// The browsers the user can route to, with their bundle ids. Mirrors the
/// MeetAppType list in Meeting Notifier.
public enum BrowserChoice: String, CaseIterable, Equatable {
    case system, safari, chrome, arc, brave, firefox

    public var bundleId: String? {
        switch self {
        case .system: return nil
        case .safari: return "com.apple.Safari"
        case .chrome: return "com.google.Chrome"
        case .arc: return "company.thebrowser.Browser"
        case .brave: return "com.brave.Browser"
        case .firefox: return "org.mozilla.firefox"
        }
    }
}

// This list mirrors DANGEROUS_SCHEMES in the dashboard's security/url.ts. The
// two cannot share a literal across languages; keep them in sync by hand.
private let dangerousSchemes: Set<String> = [
    "javascript", "data", "file", "blob", "about", "vbscript",
]

private func isDangerous(_ url: URL) -> Bool {
    guard let scheme = url.scheme?.lowercased() else { return true }
    return dangerousSchemes.contains(scheme)
}

private func isHTTPS(_ url: URL) -> Bool {
    url.scheme?.lowercased() == "https"
}

private func param(_ name: String, in items: [URLQueryItem]) -> String? {
    items.first { $0.name == name }?.value
}

/// Parse a commandcenter:// URL into a validated route, or nil if it is not a
/// commandcenter URL or fails validation.
public func parseRoute(_ url: URL) -> CommandCenterRoute? {
    guard url.scheme?.lowercased() == commandCenterScheme else { return nil }
    let action = url.host?.lowercased()
    let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems ?? []

    switch action {
    case "settings":
        return .settings

    case "join":
        guard let raw = param("url", in: items),
              let target = URL(string: raw),
              isHTTPS(target), MeetingHosts.isMeetingHost(target.host) else {
            return nil
        }
        let platform = param("platform", in: items).flatMap(MeetingPlatform.init(rawValue:))
        return .join(url: target, platform: platform)

    case "open":
        guard let raw = param("url", in: items),
              let target = URL(string: raw),
              isHTTPS(target) else {
            return nil
        }
        return .open(url: target)

    case "openprovider":
        guard let providerId = param("providerId", in: items), !providerId.isEmpty else {
            return nil
        }
        let target = param("url", in: items).flatMap { URL(string: $0) }
        if let target, isDangerous(target) { return nil }
        return .openProvider(providerId: providerId, url: target)

    default:
        return nil
    }
}

/// Extract the per-platform browser routing map from the opaque settings.
/// Values are browser bundle ids or "system".
public func browserRouting(from settings: JSONValue?) -> [String: String] {
    guard let routing = settings?.objectValue?["browserRouting"]?.objectValue else { return [:] }
    var result: [String: String] = [:]
    for (key, value) in routing {
        if let stringValue = value.stringValue { result[key] = stringValue }
    }
    return result
}

/// The browser bundle id to open a meeting on the given platform, or nil for the
/// system default.
public func resolveBrowserBundleId(
    platform: MeetingPlatform?,
    routing: [String: String]
) -> String? {
    let key = platform?.rawValue ?? "other"
    let value = routing[key] ?? routing["other"]
    guard let value, value != "system", !value.isEmpty else { return nil }
    return value
}
