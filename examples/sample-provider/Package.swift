// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "SampleProvider",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(path: "../../packages/CommandCenterKit"),
        .package(path: "../../core"),
    ],
    targets: [
        .target(
            name: "SampleProvider",
            dependencies: [
                .product(name: "CommandCenterKit", package: "CommandCenterKit"),
                .product(name: "CommandCenterCore", package: "core"),
            ]
        ),
        .executableTarget(
            name: "sample-provider",
            dependencies: [
                "SampleProvider",
                .product(name: "CommandCenterKit", package: "CommandCenterKit"),
            ]
        ),
        .testTarget(
            name: "SampleProviderTests",
            dependencies: [
                "SampleProvider",
                .product(name: "CommandCenterCore", package: "core"),
            ]
        ),
    ]
)
