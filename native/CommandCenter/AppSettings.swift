import CommandCenterCore
import Foundation

/// App-side settings model. Loads the opaque settings document via the core
/// SettingsStore, exposes the fields the native UI edits, and persists changes
/// back. The theme itself lives in ThemeStore (UserDefaults), matching Sync Bar;
/// these are the dashboard-facing preferences. No token is ever stored here.
@MainActor
final class AppSettings: ObservableObject {
    static let shared = AppSettings()

    struct City: Identifiable, Equatable {
        let id = UUID()
        var label: String
        var timeZone: String
    }

    @Published var weatherUnits: String
    @Published var browserRouting: [String: String]
    @Published var cities: [City]

    private let store: SettingsStore
    private var document: JSONValue

    private init() {
        store = SettingsStore(containerURL: AppContainer.url())
        let loaded = store.read() ?? defaultSettingsDocument()
        document = loaded

        let root = loaded.objectValue
        weatherUnits = root?["weather"]?.objectValue?["units"]?.stringValue ?? "fahrenheit"
        browserRouting = CommandCenterCore.browserRouting(from: loaded)
        cities = (root?["worldClock"]?.objectValue?["cities"]?.arrayValue ?? []).compactMap { item in
            guard let object = item.objectValue,
                  let label = object["label"]?.stringValue,
                  let timeZone = object["timeZone"]?.stringValue else { return nil }
            return City(label: label, timeZone: timeZone)
        }
    }

    func save() {
        var root = document.objectValue ?? [:]

        var weather = root["weather"]?.objectValue ?? [:]
        weather["units"] = .string(weatherUnits)
        root["weather"] = .object(weather)

        root["browserRouting"] = .object(browserRouting.mapValues { JSONValue.string($0) })

        var worldClock = root["worldClock"]?.objectValue ?? [:]
        worldClock["cities"] = .array(cities.map { city in
            .object(["label": .string(city.label), "timeZone": .string(city.timeZone)])
        })
        root["worldClock"] = .object(worldClock)

        document = .object(root)
        do {
            try store.write(document)
        } catch {
            NSLog("CommandCenter: failed to save settings: \(error)")
        }
    }
}
