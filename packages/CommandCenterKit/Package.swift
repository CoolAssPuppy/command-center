// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "CommandCenterKit",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "CommandCenterKit", targets: ["CommandCenterKit"]),
    ],
    dependencies: [
        .package(path: "../../core"),
    ],
    targets: [
        .target(
            name: "CommandCenterKit",
            dependencies: [.product(name: "CommandCenterCore", package: "core")]
        ),
        .testTarget(
            name: "CommandCenterKitTests",
            dependencies: ["CommandCenterKit"]
        ),
    ]
)
