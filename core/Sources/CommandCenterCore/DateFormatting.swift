import Foundation

/// A shared ISO 8601 formatter. ISO8601DateFormatter is thread-safe once
/// configured, so a single instance avoids re-allocating one per timestamp.
public enum ISO8601 {
    public static let formatter = ISO8601DateFormatter()
}
