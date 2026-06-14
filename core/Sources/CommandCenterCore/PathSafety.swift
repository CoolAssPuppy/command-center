import Foundation

/// Resolve a relative path against a base directory, refusing any path that
/// escapes it, including via `..` traversal AND symlinks. Both the read side
/// (FeedStore) and the write side (FeedPublisher) use this so the provider
/// folder boundary is enforced symmetrically. A provider's manifest controls
/// these paths, so they are never trusted to stay in bounds.
func containedURL(base: URL, relativePath: String) -> URL? {
    let resolvedBase = base.resolvingSymlinksInPath().standardizedFileURL
    let candidate = base
        .appendingPathComponent(relativePath)
        .resolvingSymlinksInPath()
        .standardizedFileURL
    let basePrefix = resolvedBase.path.hasSuffix("/") ? resolvedBase.path : resolvedBase.path + "/"
    if candidate.path == resolvedBase.path || candidate.path.hasPrefix(basePrefix) {
        return candidate
    }
    return nil
}
