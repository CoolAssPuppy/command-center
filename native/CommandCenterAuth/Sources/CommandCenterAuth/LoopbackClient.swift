import Foundation
import Network

/// The appex side of the loopback: connect to 127.0.0.1, send one length-prefixed
/// request, read the length-prefixed response, close. Framing comes from AuthWire
/// so it cannot drift from the app's endpoint. Not unit-tested (it opens a real
/// socket); the framing and codecs it relies on are tested separately. Adapted
/// from the archived LoopbackSocketClient.
public final class LoopbackClient {
    private let host: NWEndpoint.Host
    private let port: NWEndpoint.Port

    public enum ClientError: Error { case invalidResponseLength }

    public init(host: String = AuthWire.loopbackHost, port: UInt16 = AuthWire.defaultPort) {
        self.host = NWEndpoint.Host(host)
        self.port = NWEndpoint.Port(rawValue: port) ?? NWEndpoint.Port(rawValue: AuthWire.defaultPort)!
    }

    public func send(_ request: Data) async throws -> Data {
        let connection = NWConnection(host: host, port: port, using: .tcp)
        let queue = DispatchQueue(label: "com.strategicnerds.commandcenter.auth.client")
        connection.start(queue: queue)
        defer { connection.cancel() }

        try await write(AuthWire.frame(request), over: connection)
        let lengthBytes = try await read(exactly: 4, over: connection)
        guard let length = AuthWire.decodeLength(lengthBytes) else {
            throw ClientError.invalidResponseLength
        }
        return try await read(exactly: length, over: connection)
    }

    private func write(_ data: Data, over connection: NWConnection) async throws {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
            connection.send(content: data, completion: .contentProcessed { error in
                if let error { continuation.resume(throwing: error) } else { continuation.resume() }
            })
        }
    }

    private func read(exactly count: Int, over connection: NWConnection) async throws -> Data {
        try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Data, Error>) in
            connection.receive(minimumIncompleteLength: count, maximumLength: count) { data, _, _, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: data ?? Data()) }
            }
        }
    }
}
