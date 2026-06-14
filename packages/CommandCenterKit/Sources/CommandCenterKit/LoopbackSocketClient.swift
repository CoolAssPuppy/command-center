import CommandCenterCore
import Foundation
import Network

/// The real loopback socket client: connect to 127.0.0.1, send a length-prefixed
/// request, read the length-prefixed response, close. Uses IngestWire (in
/// CommandCenterCore) for the framing and the size cap, so it cannot drift from
/// the app's endpoint. Not exercised by unit tests (it opens a real socket).
public final class LoopbackSocketClient: IngestSocketClient {
    private let host: NWEndpoint.Host
    private let port: NWEndpoint.Port

    public init(host: String = IngestWire.loopbackHost, port: UInt16 = IngestWire.defaultPort) {
        self.host = NWEndpoint.Host(host)
        self.port = NWEndpoint.Port(rawValue: port) ?? NWEndpoint.Port(rawValue: IngestWire.defaultPort)!
    }

    public enum SocketError: Error { case invalidResponseLength }

    public func send(_ request: Data) async throws -> Data {
        let connection = NWConnection(host: host, port: port, using: .tcp)
        let queue = DispatchQueue(label: "com.strategicnerds.commandcenterkit.socket")
        connection.start(queue: queue)
        defer { connection.cancel() }

        try await send(IngestWire.frame(request), over: connection)
        let lengthBytes = try await receive(exactly: 4, over: connection)
        guard let length = IngestWire.decodeLength(lengthBytes) else {
            throw SocketError.invalidResponseLength
        }
        return try await receive(exactly: length, over: connection)
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
