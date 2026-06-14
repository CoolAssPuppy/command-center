import CommandCenterCore
import Foundation

/// Sends a length-framed request to the loopback endpoint and returns the
/// response. The concrete NWConnection client is thin and injected, so the
/// transport's encoding/decoding logic is unit-tested with a stub.
public protocol IngestSocketClient {
    func send(_ request: Data) async throws -> Data
}

/// Stores the provider's capability token. The real store is Keychain-backed;
/// tests use the in-memory one. A token is a secret: never log it.
public protocol TokenStore {
    func token(forProviderId providerId: String) -> String?
    func setToken(_ token: String, forProviderId providerId: String)
}

public final class InMemoryTokenStore: TokenStore {
    private var tokens: [String: String] = [:]
    public init() {}
    public func token(forProviderId providerId: String) -> String? { tokens[providerId] }
    public func setToken(_ token: String, forProviderId providerId: String) {
        tokens[providerId] = token
    }
}

/// The endpoint transport: for sandboxed apps that cannot write the well-known
/// directory but can open a loopback connection.
public struct EndpointTransport: IngestTransport {
    private let client: IngestSocketClient
    private let tokenStore: TokenStore

    public init(client: IngestSocketClient, tokenStore: TokenStore) {
        self.client = client
        self.tokenStore = tokenStore
    }

    public func register(
        providerId: String,
        bundleId: String,
        displayName: String,
        manifest: JSONValue
    ) async throws {
        let request = IngestRequest.register(
            providerId: providerId, bundleId: bundleId,
            displayName: displayName, manifest: manifest
        )
        _ = try await roundTrip(request)
    }

    public func publish(providerId: String, feed: JSONValue, to path: String) async throws {
        guard let token = tokenStore.token(forProviderId: providerId) else {
            throw CommandCenterKitError.notApproved
        }
        let request = IngestRequest.publish(
            providerId: providerId, token: token, path: path, feed: feed
        )
        _ = try await roundTrip(request)
    }

    @discardableResult
    private func roundTrip(_ request: IngestRequest) async throws -> IngestResponse {
        let data = try JSONEncoder().encode(request)
        let responseData = try await client.send(data)
        let response = try JSONDecoder().decode(IngestResponse.self, from: responseData)
        if !response.ok {
            throw CommandCenterKitError.refused(response.error ?? "refused")
        }
        return response
    }
}
