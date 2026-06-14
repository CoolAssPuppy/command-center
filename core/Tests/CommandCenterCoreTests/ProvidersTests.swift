import XCTest
@testable import CommandCenterCore

final class ProvidersTests: XCTestCase {
    private func registration(_ id: String, _ name: String, _ consent: ProviderRegistration.Consent) -> ProviderRegistration {
        ProviderRegistration(
            providerId: id, bundleId: "com.\(id)", displayName: name,
            consent: consent, tokenHash: nil, manifest: nil
        )
    }

    func testMapsAndSortsByDisplayNameCaseInsensitively() {
        let rows = providerRows(from: [
            registration("b", "Beta", .approved),
            registration("a", "alpha", .pending),
        ])
        XCTAssertEqual(rows.map(\.displayName), ["alpha", "Beta"])
        XCTAssertEqual(rows.first?.consent, .pending)
    }

    func testCarriesConsentAndIds() {
        let rows = providerRows(from: [registration("acme", "Acme", .denied)])
        XCTAssertEqual(rows.first, ProviderRow(
            providerId: "acme", displayName: "Acme", bundleId: "com.acme", consent: .denied
        ))
    }
}
