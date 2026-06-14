//
//  MenuBarPopover.swift
//  Command Center
//
//  The menu-bar popover, styled to match Sync Bar: header, themed body, footer.
//

import SwiftUI

struct MenuBarPopover: View {
    @ObservedObject private var themeStore = ThemeStore.shared
    let openSettings: () -> Void
    let quit: () -> Void

    var body: some View {
        let theme = themeStore.palette
        return VStack(spacing: 0) {
            header(theme)
            Divider().overlay(theme.divider)
            content(theme)
            Divider().overlay(theme.divider)
            footer(theme)
        }
        .frame(width: 320)
        .background(theme.background)
        .environment(\.theme, theme)
        .environment(\.colorScheme, theme.isDark ? .dark : .light)
    }

    private func header(_ theme: ThemePalette) -> some View {
        HStack(spacing: AppSpacing.md) {
            Image(systemName: "rectangle.grid.2x2.fill")
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(theme.primary)
            Text("Command Center")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(theme.foreground)
            Spacer()
        }
        .padding(AppSpacing.lg)
    }

    private func content(_ theme: ThemePalette) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            SectionLabel(text: "Theme")
            Picker("", selection: $themeStore.current) {
                ForEach(AppTheme.allCases) { Text($0.label).tag($0) }
            }
            .labelsHidden()
            .pickerStyle(.menu)
            Text("Open a new tab in Safari to see your dashboard.")
                .font(.system(size: 12))
                .foregroundStyle(theme.muted)
                .padding(.top, AppSpacing.xs)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, AppSpacing.lg)
        .padding(.vertical, AppSpacing.md)
    }

    private func footer(_ theme: ThemePalette) -> some View {
        HStack {
            popoverButton("Settings", icon: "gearshape", theme: theme, action: openSettings)
            Spacer()
            popoverButton("Quit", icon: "power", theme: theme, action: quit)
        }
        .padding(AppSpacing.lg)
    }

    private func popoverButton(
        _ title: String,
        icon: String,
        theme: ThemePalette,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: AppSpacing.sm) {
                Image(systemName: icon).font(.system(size: 12, weight: .medium))
                Text(title).font(.system(size: 12.5, weight: .medium))
            }
            .foregroundStyle(theme.foregroundSoft)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }
}
