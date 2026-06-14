import CommandCenterCore
import SwiftUI

/// The providers consent card: lists apps that asked to publish, with Approve /
/// Deny / Revoke, and a one-time token-delivery row after approval. Matches the
/// suite theme; no decorative borders.
struct ProvidersCard: View {
    @StateObject private var model = ProvidersModel()
    @Environment(\.theme) private var theme

    var body: some View {
        Card {
            SectionLabel(text: "Connected apps")
            if model.rows.isEmpty {
                Text("No apps have asked to publish yet.")
                    .font(.system(size: 12))
                    .foregroundStyle(theme.muted)
            } else {
                ForEach(model.rows, id: \.providerId) { row in
                    providerRow(row)
                }
            }
            if let approved = model.approvedToken {
                tokenDelivery(approved)
            }
        }
    }

    private func providerRow(_ row: ProviderRow) -> some View {
        HStack(spacing: AppSpacing.md) {
            VStack(alignment: .leading, spacing: 2) {
                Text(row.displayName)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(theme.foreground)
                Text(consentLabel(row.consent))
                    .font(.system(size: 11))
                    .foregroundStyle(consentColor(row.consent))
            }
            Spacer()
            actions(for: row)
        }
    }

    @ViewBuilder
    private func actions(for row: ProviderRow) -> some View {
        HStack(spacing: AppSpacing.md) {
            if row.consent != .approved {
                Button("Approve") { model.approve(row) }
            }
            if row.consent == .pending {
                Button("Deny") { model.deny(row) }
            }
            Button("Revoke") { model.revoke(row) }
        }
        .font(.system(size: 12, weight: .medium))
        .buttonStyle(.plain)
        .foregroundStyle(theme.primary)
    }

    private func tokenDelivery(_ approved: ProvidersModel.ApprovedToken) -> some View {
        VStack(alignment: .leading, spacing: AppSpacing.sm) {
            Divider().overlay(theme.divider)
            Text("Paste this token into \(approved.displayName) to finish connecting. It is shown only once.")
                .font(.system(size: 12))
                .foregroundStyle(theme.muted)
            HStack(spacing: AppSpacing.md) {
                Text(approved.token)
                    .font(.system(size: 11, design: .monospaced))
                    .textSelection(.enabled)
                    .lineLimit(1)
                    .truncationMode(.middle)
                Spacer()
                Button("Copy") { model.copyToken() }
                    .buttonStyle(.plain)
                    .foregroundStyle(theme.primary)
                Button("Done") { model.dismissToken() }
                    .buttonStyle(.plain)
                    .foregroundStyle(theme.muted)
            }
        }
    }

    private func consentLabel(_ consent: ProviderRegistration.Consent) -> String {
        switch consent {
        case .pending: return "Pending approval"
        case .approved: return "Approved"
        case .denied: return "Denied"
        }
    }

    private func consentColor(_ consent: ProviderRegistration.Consent) -> Color {
        switch consent {
        case .pending: return theme.warning
        case .approved: return theme.success
        case .denied: return theme.destructive
        }
    }
}
