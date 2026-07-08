import CommandCenterAuth
import Foundation
import Network

/// The app side of the loopback: bind 127.0.0.1, read one length-prefixed
/// authorize request, run the OAuth flow, write the length-prefixed response,
/// close. Only the framing and sockets live here; every decision (PKCE, the
/// exchange, the Keychain) is in GoogleAuthService and the tested core. The
/// listener is loopback-only and never logs a token. Adapted from the archived
/// IngestEndpoint.
final class AuthEndpoint {
    private let authService: GoogleAuthService
    private let port: NWEndpoint.Port
    private let queue = DispatchQueue(label: "com.strategicnerds.commandcenter.auth.endpoint")
    private var listener: NWListener?

    init(authService: GoogleAuthService, port: UInt16 = AuthWire.defaultPort) {
        self.authService = authService
        self.port = NWEndpoint.Port(rawValue: port) ?? NWEndpoint.Port(rawValue: AuthWire.defaultPort)!
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
            guard let self, error == nil, let data, let length = AuthWire.decodeLength(data) else {
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
            self.handle(data, on: connection)
        }
    }

    private func handle(_ data: Data, on connection: NWConnection) {
        guard let request = AuthorizeCoding.decodeRequest(data),
              request.type == "google-authorize" else {
            reply(.failure("invalid_request"), on: connection)
            return
        }
        // Authorize is async and main-actor bound (it may present a sheet); hop to
        // the main actor, then frame the reply back on the socket queue.
        Task { @MainActor in
            let response = await self.authService.authorize(
                interactive: request.interactive, loginHint: request.loginHint
            )
            self.reply(response, on: connection)
        }
    }

    private func reply(_ response: AuthorizeResponse, on connection: NWConnection) {
        connection.send(
            content: AuthWire.frame(AuthorizeCoding.encode(response)),
            completion: .contentProcessed { _ in connection.cancel() }
        )
    }
}
