import Foundation

/// A registration flattened for display in the providers consent screen. The
/// token hash and manifest are intentionally omitted; the UI never needs them.
public struct ProviderRow: Equatable {
    public let providerId: String
    public let displayName: String
    public let bundleId: String
    public let consent: ProviderRegistration.Consent
}

/// Map registrations to display rows, sorted by display name. Pure and tested;
/// the app's view-model just renders the result and routes actions to the
/// IngestHandler.
public func providerRows(from registrations: [ProviderRegistration]) -> [ProviderRow] {
    registrations
        .map {
            ProviderRow(
                providerId: $0.providerId,
                displayName: $0.displayName,
                bundleId: $0.bundleId,
                consent: $0.consent
            )
        }
        .sorted { $0.displayName.lowercased() < $1.displayName.lowercased() }
}
