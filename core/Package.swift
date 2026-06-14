// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "CommandCenterCore",
    platforms: [.macOS(.v13)],
    products: [
        .library(name: "CommandCenterCore", targets: ["CommandCenterCore"]),
    ],
    targets: [
        .target(name: "CommandCenterCore"),
        .testTarget(
            name: "CommandCenterCoreTests",
            dependencies: ["CommandCenterCore"]
        ),
    ]
)
