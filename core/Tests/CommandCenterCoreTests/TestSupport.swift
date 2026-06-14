import Foundation
import XCTest
@testable import CommandCenterCore

/// Shared test helpers, compiled into the test target alongside every test file.

/// A ProviderLocator backed by an explicit installed set. `.all` treats every
/// provider as installed (the shared `AllInstalledProviderLocator` from core).
struct StubLocator: ProviderLocator {
    let installed: Set<String>
    init(installed: Set<String>) { self.installed = installed }
    func isInstalled(bundleId: String) -> Bool { installed.contains(bundleId) }

    static let all = AllInstalledProviderLocator()
}

extension XCTestCase {
    /// Create a unique temp container directory, auto-removed at teardown.
    func makeTempContainer() throws -> URL {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("cc-test-\(UUID().uuidString)", isDirectory: true)
        try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
        addTeardownBlock { try? FileManager.default.removeItem(at: url) }
        return url
    }

    /// Write a string to a relative path inside a container, creating parents.
    func write(_ contents: String, to relativePath: String, in container: URL) throws {
        let url = container.appendingPathComponent(relativePath)
        try FileManager.default.createDirectory(
            at: url.deletingLastPathComponent(),
            withIntermediateDirectories: true
        )
        try Data(contents.utf8).write(to: url)
    }
}
