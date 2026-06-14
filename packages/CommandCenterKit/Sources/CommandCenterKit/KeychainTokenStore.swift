import Foundation
import Security

/// Keychain-backed token storage. The capability token is a secret, so it lives
/// in the Keychain, not a file. Thin wrapper over SecItem; not exercised by unit
/// tests. Token values are never logged.
public final class KeychainTokenStore: TokenStore {
    private let service: String

    public init(service: String = "com.strategicnerds.commandcenter.kit.token") {
        self.service = service
    }

    public func token(forProviderId providerId: String) -> String? {
        var query = baseQuery(providerId)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data else {
            return nil
        }
        return String(data: data, encoding: .utf8)
    }

    public func setToken(_ token: String, forProviderId providerId: String) {
        let data = Data(token.utf8)
        let query = baseQuery(providerId)
        let attributes: [String: Any] = [kSecValueData as String: data]

        let status = SecItemUpdate(query as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData as String] = data
            SecItemAdd(addQuery as CFDictionary, nil)
        }
    }

    private func baseQuery(_ providerId: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: providerId,
        ]
    }
}
