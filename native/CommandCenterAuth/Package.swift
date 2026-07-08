// swift-tools-version: 5.9
import PackageDescription

// The shared OAuth core, linked by both the container app and the Safari
// appex. Everything here is pure and unit-tested: PKCE, the auth URL, the token
// endpoint request/response models, the id_token email decoder, the loopback
// wire framing, and the Keychain refresh-token store. Keeping it in one package
// that both targets depend on is what makes the two processes agree on the
// contract without a hand-copied duplicate that could drift.
let package = Package(
    name: "CommandCenterAuth",
    platforms: [.macOS(.v14)],
    products: [
        .library(name: "CommandCenterAuth", targets: ["CommandCenterAuth"]),
    ],
    targets: [
        .target(name: "CommandCenterAuth"),
        .testTarget(
            name: "CommandCenterAuthTests",
            dependencies: ["CommandCenterAuth"]
        ),
    ]
)
