import Foundation

/// The loopback ingest wire contract, shared by the app's endpoint (server) and
/// the SDK's client so the two cannot drift. Single source for the port, the
/// size cap, and the 4-byte big-endian length-prefix framing. Both the app and
/// CommandCenterKit depend on CommandCenterCore, so this is their common home.
public enum IngestWire {
    public static let defaultPort: UInt16 = 4849
    public static let loopbackHost = "127.0.0.1"
    public static let maxMessageBytes = 1 << 20 // 1 MB

    /// A payload framed as a 4-byte big-endian length prefix followed by the bytes.
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
    /// 1...maxMessageBytes, so neither side can be made to read an unbounded body.
    public static func decodeLength(_ prefix: Data) -> Int? {
        guard prefix.count == 4 else { return nil }
        let length = prefix.reduce(0) { ($0 << 8) | Int($1) }
        guard length > 0, length <= maxMessageBytes else { return nil }
        return length
    }
}
