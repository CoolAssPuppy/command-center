import Foundation
import Security

/// Where a refresh token is a secret, it lives in the Keychain, not a file.
/// Keyed by account email, so each connected Google account keeps its own
/// long-lived grant. Only the container app reads or writes this; the appex never
/// touches it. Values are never logged. Thin wrapper over SecItem with upsert
/// semantics. Adapted from the archived KeychainTokenStore.
public protocol RefreshTokenStoring {
    func refreshToken(forEmail email: String) -> String?
    func setRefreshToken(_ token: String, forEmail email: String)
    func removeRefreshToken(forEmail email: String)
}

public final class KeychainTokenStore: RefreshTokenStoring {
    private let service: String

    public init(service: String = "com.strategicnerds.commandcenter.google.refresh") {
        self.service = service
    }

    public func refreshToken(forEmail email: String) -> String? {
        var query = baseQuery(email)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var result: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
              let data = result as? Data,
              let token = String(data: data, encoding: .utf8)
        else { return nil }
        return token
    }

    public func setRefreshToken(_ token: String, forEmail email: String) {
        let data = Data(token.utf8)
        let query = baseQuery(email)

        let status = SecItemUpdate(
            query as CFDictionary,
            [kSecValueData as String: data] as CFDictionary
        )
        if status == errSecItemNotFound {
            var addQuery = query
            addQuery[kSecValueData as String] = data
            SecItemAdd(addQuery as CFDictionary, nil)
        }
    }

    public func removeRefreshToken(forEmail email: String) {
        SecItemDelete(baseQuery(email) as CFDictionary)
    }

    private func baseQuery(_ email: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: email,
        ]
    }
}
