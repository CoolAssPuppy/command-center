import CommandCenterCore
import Foundation
import Network

/// The loopback ingest transport. It binds a TCP listener on 127.0.0.1, reads a
/// length-prefixed request, hands the bytes to the pure dispatcher in
/// CommandCenterCore, and writes the length-prefixed response. All decisions
/// (consent, token validation) live in the dispatcher/IngestHandler; this is
/// just framing and sockets. It never logs token values.
final class IngestEndpoint {
    private let handler: IngestHandler
    private let port: NWEndpoint.Port
    private let queue = DispatchQueue(label: "com.strategicnerds.commandcenter.ingest")
    private var listener: NWListener?

    init(containerURL: URL, port: UInt16 = IngestWire.defaultPort) {
        self.handler = IngestHandler(containerURL: containerURL)
        self.port = NWEndpoint.Port(rawValue: port) ?? NWEndpoint.Port(rawValue: IngestWire.defaultPort)!
    }

    func start() {
        let parameters = NWParameters.tcp
        parameters.requiredInterfaceType = .loopback
        guard let listener = try? NWListener(using: parameters, on: port) else { return }
        listener.newConnectionHandler = { [weak self] connection in
            connection.start(queue: self?.queue ?? .main)
            self?.receiveLength(on: connection)
        }
        listener.start(queue: queue)
        self.listener = listener
    }

    func stop() {
        listener?.cancel()
        listener = nil
    }

    private func receiveLength(on connection: NWConnection) {
        connection.receive(minimumIncompleteLength: 4, maximumLength: 4) { [weak self] data, _, _, error in
            guard let self, error == nil, let data, let length = IngestWire.decodeLength(data) else {
                connection.cancel()
                return
            }
            self.receiveBody(length: length, on: connection)
        }
    }

    private func receiveBody(length: Int, on connection: NWConnection) {
        connection.receive(minimumIncompleteLength: length, maximumLength: length) { [weak self] data, _, _, error in
            guard let self, error == nil, let data else {
                connection.cancel()
                return
            }
            let response = handleIngestMessage(data, using: self.handler)
            self.send(response, on: connection)
        }
    }

    private func send(_ payload: Data, on connection: NWConnection) {
        connection.send(
            content: IngestWire.frame(payload),
            completion: .contentProcessed { _ in connection.cancel() }
        )
    }
}
