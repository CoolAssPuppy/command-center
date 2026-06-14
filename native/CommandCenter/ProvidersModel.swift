import AppKit
import CommandCenterCore
import Foundation

/// View-model for the providers consent screen. Loads rows from the registration
/// store and routes Approve/Deny/Revoke to the IngestHandler. The one-time token
/// from approval is held in memory only (never persisted, never logged) so the
/// UI can show it once for the user to deliver to the provider.
@MainActor
final class ProvidersModel: ObservableObject {
    struct ApprovedToken: Equatable {
        let providerId: String
        let displayName: String
        let token: String
    }

    @Published var rows: [ProviderRow] = []
    @Published var approvedToken: ApprovedToken?

    private let containerURL: URL

    init(containerURL: URL = AppContainer.url()) {
        self.containerURL = containerURL
        reload()
    }

    private var handler: IngestHandler { IngestHandler(containerURL: containerURL) }

    func reload() {
        rows = providerRows(from: RegistrationStore(containerURL: containerURL).all())
    }

    func approve(_ row: ProviderRow) {
        // try? flattens the throwing String? into a single optional.
        if let token = try? handler.approve(providerId: row.providerId) {
            approvedToken = ApprovedToken(providerId: row.providerId, displayName: row.displayName, token: token)
        }
        reload()
    }

    func deny(_ row: ProviderRow) {
        try? handler.deny(providerId: row.providerId)
        reload()
    }

    func revoke(_ row: ProviderRow) {
        try? handler.revoke(providerId: row.providerId)
        if approvedToken?.providerId == row.providerId { approvedToken = nil }
        reload()
    }

    func dismissToken() {
        approvedToken = nil
    }

    func copyToken() {
        guard let token = approvedToken?.token else { return }
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(token, forType: .string)
    }
}
