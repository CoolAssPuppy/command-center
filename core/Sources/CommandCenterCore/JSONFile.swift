import Foundation

/// Encode a value to JSON and write it atomically, creating parent directories.
/// Shared by the settings, registration, and feed writers so the
/// create-directory + encode + atomic-write pattern lives in exactly one place.
func writeJSONAtomically<T: Encodable>(
    _ value: T,
    to url: URL,
    using fileManager: FileManager
) throws {
    try fileManager.createDirectory(
        at: url.deletingLastPathComponent(),
        withIntermediateDirectories: true
    )
    let data = try JSONEncoder().encode(value)
    try data.write(to: url, options: .atomic)
}
