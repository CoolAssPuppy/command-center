import Foundation

/// The loopback wire contract shared by the appex (client) and the app (server),
/// so the two can never drift on the port, the size cap, or the framing. A
/// request is a 4-byte big-endian length prefix followed by that many JSON
/// bytes; the response is framed the same way. Loopback only: the listener binds
/// 127.0.0.1 and is never exposed off-device. Adapted from the archived
/// IngestWire, which proved this framing in real use.
public enum AuthWire {
    public static let loopbackHost = "127.0.0.1"
    public static let defaultPort: UInt16 = 4849
    public static let maxMessageBytes = 1 << 16 // 64 KB; a token exchange is tiny.

    /// Frame a payload as a 4-byte big-endian length prefix plus the bytes.
    public static func frame(_ payload: Data) -> Data {
        let count = UInt32(payload.count)
        var data = Data([
            UInt8(count >> 24 & 0xFF),
            UInt8(count >> 16 & 0xFF),
            UInt8(count >> 8 & 0xFF),
            UInt8(count & 0xFF),
        ])
        data.append(payload)
        return data
    }

    /// Decode a 4-byte big-endian length prefix into a bounded body length.
    /// Returns nil unless it is exactly 4 bytes and the length is in
    /// 1...maxMessageBytes, so neither side can be driven to read an unbounded body.
    public static func decodeLength(_ prefix: Data) -> Int? {
        guard prefix.count == 4 else { return nil }
        let length = prefix.reduce(0) { ($0 << 8) | Int($1) }
        guard length > 0, length <= maxMessageBytes else { return nil }
        return length
    }
}
