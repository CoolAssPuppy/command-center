//
//  Theme.swift
//  Command Center
//
//  The shared Strategic Nerds design system, ported from Sync Bar so the native
//  app matches its look and feel (the dashboard keeps its own web themes).
//

import AppKit
import SwiftUI

// MARK: - Palette

struct ThemePalette: Equatable {
    let isDark: Bool

    let background: Color
    let surface: Color
    let card: Color
    let cardElevated: Color
    let cardInset: Color

    let border: Color
    let borderStrong: Color
    let borderFocus: Color
    let divider: Color
    let dividerSubtle: Color

    let foreground: Color
    let foregroundSoft: Color
    let muted: Color
    let tertiary: Color
    let dim: Color

    let primary: Color
    let primaryDeep: Color
    let primaryForeground: Color
    let success: Color
    let warning: Color
    let destructive: Color

    var nsBackground: NSColor { NSColor(background) }
    var nsAppearance: NSAppearance? { NSAppearance(named: isDark ? .darkAqua : .aqua) }
}

// MARK: - Themes

enum AppTheme: String, CaseIterable, Identifiable {
    case system
    case hoth, risa, weasley, starbuck
    case cylon, vader, kirk, hermione, nerds

    var id: String { rawValue }

    var label: String {
        switch self {
        case .system: return "System"
        case .hoth: return "Hoth"
        case .risa: return "Risa"
        case .weasley: return "Weasley"
        case .starbuck: return "Starbuck"
        case .cylon: return "Cylon"
        case .vader: return "Vader"
        case .kirk: return "Kirk"
        case .hermione: return "Hermione"
        case .nerds: return "Nerds"
        }
    }

    @MainActor var isDark: Bool { palette.isDark }

    @MainActor var palette: ThemePalette {
        switch self {
        case .system:
            let isDark = (NSApp?.effectiveAppearance.bestMatch(from: [.aqua, .darkAqua]) ?? .aqua) == .darkAqua
            return isDark ? .systemDark : .systemLight
        case .hoth: return .hoth
        case .risa: return .risa
        case .weasley: return .weasley
        case .starbuck: return .starbuck
        case .cylon: return .cylon
        case .vader: return .vader
        case .kirk: return .kirk
        case .hermione: return .hermione
        case .nerds: return .nerds
        }
    }
}

// MARK: - Spacing tokens

enum AppRadius {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 6
    static let md: CGFloat = 8
    static let lg: CGFloat = 10
    static let xl: CGFloat = 12
    static let xxl: CGFloat = 14
}

enum AppSpacing {
    static let xs: CGFloat = 4
    static let sm: CGFloat = 6
    static let md: CGFloat = 8
    static let lg: CGFloat = 12
    static let xl: CGFloat = 16
    static let xxl: CGFloat = 20
    static let xxxl: CGFloat = 28
}

// MARK: - SwiftUI environment

private struct CurrentPaletteKey: EnvironmentKey {
    static let defaultValue: ThemePalette = .nerds
}

extension EnvironmentValues {
    var theme: ThemePalette {
        get { self[CurrentPaletteKey.self] }
        set { self[CurrentPaletteKey.self] = newValue }
    }
}
