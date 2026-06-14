import Foundation
import Network

/// The real loopback socket client: connect to 127.0.0.1, send a length-prefixed
/// request, read the length-prefixed response, close. Thin transport plumbing,
/// mirroring the framing in the app's IngestEndpoint. Not exercised by unit
/// tests (it opens a real socket).
public final class LoopbackSocketClient: IngestSocketClient {
    private let host: NWEndpoint.Host
    private let port: NWEndpoint.Port

    public init(host: String = "127.0.0.1", port: UInt16 = 4849) {
        self.host = NWEndpoint.Host(host)
        self.port = NWEndpoint.Port(rawValue: port) ?? NWEndpoint.Port(rawValue: 4849)!
    }

    public func send(_ request: Data) async throws -> Data {
        let connection = NWConnection(host: host, port: port, using: .tcp)
        let queue = DispatchQueue(label: "com.strategicnerds.commandcenterkit.socket")
        connection.start(queue: queue)
        defer { connection.cancel() }

        try await send(framed(request), over: connection)
        let lengthBytes = try await receive(exactly: 4, over: connection)
        let length = lengthBytes.reduce(0) { ($0 << 8) | Int($1) }
        return try await receive(exactly: length, over: connection)
    }

    private func framed(_ payload: Data) -> Data {
        let count = UInt32(payload.count)
        var frame = Data([
            UInt8(count >> 24 & 0xFF), UInt8(count >> 16 & 0xFF),
            UInt8(count >> 8 & 0xFF), UInt8(count & 0xFF),
        ])
        frame.append(payload)
        return frame
    }

    private func send(_ data: Data, over connection: NWConnection) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            connection.send(content: data, completion: .contentProcessed { error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume() }
            })
        }
    }

    private func receive(exactly count: Int, over connection: NWConnection) async throws -> Data {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Data, Error>) in
            connection.receive(minimumIncompleteLength: count, maximumLength: count) { data, _, _, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: data ?? Data()) }
            }
        }
    }
}
