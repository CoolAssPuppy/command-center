//
//  ThemeStore.swift
//  Command Center
//
//  Ported from Sync Bar. Persists the chosen theme in UserDefaults and
//  re-publishes when the OS flips light/dark while the System theme is active.
//

import AppKit
import SwiftUI

@MainActor
final class ThemeStore: ObservableObject {
    static let shared = ThemeStore()

    private static let defaultsKey = "appTheme"

    @Published var current: AppTheme {
        didSet { UserDefaults.standard.set(current.rawValue, forKey: Self.defaultsKey) }
    }

    private var appearanceObserver: NSKeyValueObservation?

    private init() {
        let raw = UserDefaults.standard.string(forKey: Self.defaultsKey) ?? AppTheme.nerds.rawValue
        self.current = AppTheme(rawValue: raw) ?? .nerds

        appearanceObserver = NSApp?.observe(\.effectiveAppearance, options: [.new]) { [weak self] _, _ in
            Task { @MainActor in
                guard let self, self.current == .system else { return }
                self.objectWillChange.send()
            }
        }
    }

    var palette: ThemePalette { current.palette }
}
