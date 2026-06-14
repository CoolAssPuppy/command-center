//
//  Components.swift
//  Command Center
//
//  Shared building blocks matching the Sync Bar / Meeting Notifier look. No
//  decorative borders: surfaces use the theme card color with soft elevation.
//

import SwiftUI

/// A small uppercase tracked section label.
struct SectionLabel: View {
    let text: String
    @Environment(\.theme) private var theme

    var body: some View {
        Text(text.uppercased())
            .font(.system(size: 11, weight: .semibold))
            .tracking(1.5)
            .foregroundStyle(theme.tertiary)
    }
}

/// A themed card container with padding and soft elevation, no hairline border.
struct Card<Content: View>: View {
    @Environment(\.theme) private var theme
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: AppSpacing.md) {
            content
        }
        .padding(AppSpacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: AppRadius.xl, style: .continuous)
                .fill(theme.card)
                .shadow(color: .black.opacity(theme.isDark ? 0.35 : 0.10), radius: 10, y: 4)
        )
    }
}

/// A labeled settings row: a title on the left, a control on the right.
struct SettingRow<Control: View>: View {
    let title: String
    @ViewBuilder var control: Control
    @Environment(\.theme) private var theme

    var body: some View {
        HStack(spacing: AppSpacing.lg) {
            Text(title)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(theme.foregroundSoft)
            Spacer(minLength: AppSpacing.lg)
            control
        }
    }
}
