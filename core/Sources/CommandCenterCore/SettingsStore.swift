import Foundation

/// Owns the settings document. The Command Center app is the only writer; the
/// extension and dashboard read it (the extension via FeedStore.loadSettings).
/// Settings are preferences only and are kept opaque on the native side: never
/// write a token or secret here. Writes are atomic so a reader never sees a
/// half-written file. iCloud key-value sync is layered on later, once the
/// entitlement is registered. See docs/08-settings-sync.md.
public struct SettingsStore {
    private let containerURL: URL
    private let fileManager: FileManager

    public init(containerURL: URL, fileManager: FileManager = .default) {
        self.containerURL = containerURL
        self.fileManager = fileManager
    }

    private var directory: URL {
        containerURL.appendingPathComponent("CommandCenter", isDirectory: true)
    }

    private var fileURL: URL {
        directory.appendingPathComponent("settings.json")
    }

    @discardableResult
    public func write(_ settings: JSONValue) throws -> URL {
        try writeJSONAtomically(settings, to: fileURL, using: fileManager)
        return fileURL
    }

    public func read() -> JSONValue? {
        guard let data = try? Data(contentsOf: fileURL) else { return nil }
        return try? JSONDecoder().decode(JSONValue.self, from: data)
    }
}

/// A sensible starting settings document, mirroring docs/08-settings-sync.md and
/// the dashboard's settings schema. Used on first launch.
public func defaultSettingsDocument() -> JSONValue {
    // Built from sub-expressions so the Swift type checker stays fast; one large
    // nested literal can blow past the type-check budget.
    let appearance: JSONValue = .object([
        "theme": .string("system"),
        "accentColorHex": .string("#7C8CFF"),
        "density": .string("comfortable"),
        "fontScale": .number(1),
    ])
    let layout: JSONValue = .object([
        "cardOrder": .array([]),
        "hidden": .array([]),
    ])
    let sanFrancisco: JSONValue = .object([
        "label": .string("San Francisco"),
        "timeZone": .string("America/Los_Angeles"),
    ])
    let london: JSONValue = .object([
        "label": .string("London"),
        "timeZone": .string("Europe/London"),
    ])
    let worldClock: JSONValue = .object(["cities": .array([sanFrancisco, london])])
    let weatherLocation: JSONValue = .object([
        "label": .string("San Francisco"),
        "lat": .number(37.7749),
        "lon": .number(-122.4194),
    ])
    let weather: JSONValue = .object([
        "location": weatherLocation,
        "units": .string("fahrenheit"),
    ])
    let browserRouting: JSONValue = .object([
        "meet": .string("com.google.Chrome"),
        "zoom": .string("system"),
        "teams": .string("com.apple.Safari"),
        "other": .string("system"),
    ])
    return .object([
        "schemaVersion": .number(1),
        "profile": .object(["name": .string("")]),
        "appearance": appearance,
        "layout": layout,
        "worldClock": worldClock,
        "weather": weather,
        "browserRouting": browserRouting,
    ])
}
