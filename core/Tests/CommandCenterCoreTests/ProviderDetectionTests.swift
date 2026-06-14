import XCTest
@testable import CommandCenterCore

final class ProviderDetectionTests: XCTestCase {
    private let payloadJson = """
    {
      "providers": [
        {
          "manifest": {
            "schemaVersion": 1, "providerId": "linear-bar", "displayName": "Linear",
            "bundleId": "com.strategicnerds.LinearBarApp", "feeds": []
          },
          "feeds": []
        },
        {
          "manifest": {
            "schemaVersion": 1, "providerId": "ghost", "displayName": "Ghost",
            "bundleId": "com.example.uninstalled", "feeds": []
          },
          "feeds": []
        }
      ]
    }
    """

    func testKeepsOnlyProvidersWhoseAppIsInstalled() {
        guard case .success(let payload) = decodeDashboardPayload(Data(payloadJson.utf8)) else {
            return XCTFail("payload should decode")
        }
        let locator = StubLocator(installed: ["com.strategicnerds.LinearBarApp"])

        let installed = installedProviders(in: payload, using: locator)

        XCTAssertEqual(installed.count, 1)
        XCTAssertEqual(installed.first?.manifest.providerId, "linear-bar")
    }

    func testDropsEverythingWhenNothingIsInstalled() {
        guard case .success(let payload) = decodeDashboardPayload(Data(payloadJson.utf8)) else {
            return XCTFail("payload should decode")
        }
        let installed = installedProviders(in: payload, using: StubLocator(installed: []))
        XCTAssertTrue(installed.isEmpty)
    }
}
