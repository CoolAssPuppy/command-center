//
//  SettingsView.swift
//  Command Center
//
//  The settings window, styled to match Sync Bar. Appearance (theme) is driven
//  by ThemeStore; the dashboard-facing preferences persist via AppSettings.
//

import CommandCenterCore
import SwiftUI

struct SettingsView: View {
    @ObservedObject private var themeStore = ThemeStore.shared
    @ObservedObject private var settings = AppSettings.shared
    @State private var newCityLabel = ""
    @State private var newCityZone = ""

    private let platforms = ["meet", "zoom", "teams", "other"]

    var body: some View {
        let theme = themeStore.palette
        return ScrollView {
            VStack(alignment: .leading, spacing: AppSpacing.xl) {
                appearanceCard
                browserCard
                weatherCard
                citiesCard
                ProvidersCard()
            }
            .padding(AppSpacing.xl)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(width: 480, height: 580)
        .background(theme.background)
        .environment(\.theme, theme)
        .environment(\.colorScheme, theme.isDark ? .dark : .light)
    }

    private var appearanceCard: some View {
        Card {
            SectionLabel(text: "Appearance")
            SettingRow(title: "Theme") {
                Picker("", selection: $themeStore.current) {
                    ForEach(AppTheme.allCases) { Text($0.label).tag($0) }
                }
                .labelsHidden()
                .frame(width: 160)
            }
        }
    }

    private var browserCard: some View {
        Card {
            SectionLabel(text: "Open meeting links in")
            ForEach(platforms, id: \.self) { platform in
                SettingRow(title: platform.capitalized) {
                    Picker("", selection: browserBinding(platform)) {
                        ForEach(BrowserChoice.allCases, id: \.self) { choice in
                            Text(choice == .system ? "System Default" : choice.rawValue.capitalized)
                                .tag(choice.bundleId ?? "system")
                        }
                    }
                    .labelsHidden()
                    .frame(width: 160)
                }
            }
        }
    }

    private var weatherCard: some View {
        Card {
            SectionLabel(text: "Weather")
            SettingRow(title: "Units") {
                Picker("", selection: unitsBinding) {
                    Text("Fahrenheit").tag("fahrenheit")
                    Text("Celsius").tag("celsius")
                }
                .labelsHidden()
                .frame(width: 160)
            }
        }
    }

    private var citiesCard: some View {
        Card {
            SectionLabel(text: "World clock")
            ForEach(settings.cities) { city in
                cityRow(city)
            }
            HStack(spacing: AppSpacing.sm) {
                TextField("Label", text: $newCityLabel).textFieldStyle(.roundedBorder)
                TextField("America/New_York", text: $newCityZone).textFieldStyle(.roundedBorder)
                Button("Add", action: addCity)
                    .disabled(newCityLabel.isEmpty || newCityZone.isEmpty)
            }
        }
    }

    private func cityRow(_ city: AppSettings.City) -> some View {
        HStack {
            Text(city.label).font(.system(size: 13, weight: .medium))
            Text(city.timeZone).font(.system(size: 12)).foregroundStyle(.secondary)
            Spacer()
            Button {
                settings.cities.removeAll { $0.id == city.id }
                settings.save()
            } label: {
                Image(systemName: "minus.circle")
            }
            .buttonStyle(.plain)
        }
    }

    private func addCity() {
        settings.cities.append(.init(label: newCityLabel, timeZone: newCityZone))
        settings.save()
        newCityLabel = ""
        newCityZone = ""
    }

    private func browserBinding(_ platform: String) -> Binding<String> {
        Binding(
            get: { settings.browserRouting[platform] ?? "system" },
            set: { settings.browserRouting[platform] = $0; settings.save() }
        )
    }

    private var unitsBinding: Binding<String> {
        Binding(
            get: { settings.weatherUnits },
            set: { settings.weatherUnits = $0; settings.save() }
        )
    }
}
