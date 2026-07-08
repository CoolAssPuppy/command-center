import AuthenticationServices
import CommandCenterAuth
import Foundation

/// Runs the Google OAuth flow inside the app, the one place a refresh token or
/// client config is ever held. Interactive sign-in opens ASWebAuthenticationSession
/// (Apple's system browser sheet, the native peer of Chrome's launchWebAuthFlow),
/// exchanges the code with PKCE, and banks the refresh token in the Keychain.
/// A silent request trades a stored refresh token for a fresh access token with
/// no UI. Either way the browser gets back only a short-lived access token. All
/// URL/body/JWT construction comes from the tested CommandCenterAuth core; this
/// type is the impure glue (system sheet + network) that composes it.
@MainActor
final class GoogleAuthService: NSObject {
    private let config: OAuthConfig
    private let store: RefreshTokenStoring
    private let session: URLSession

    init(
        config: OAuthConfig,
        store: RefreshTokenStoring = KeychainTokenStore(),
        session: URLSession = .shared
    ) {
        self.config = config
        self.store = store
        self.session = session
    }

    func authorize(interactive: Bool, loginHint: String?) async -> AuthorizeResponse {
        do {
            return interactive
                ? try await interactiveSignIn(loginHint: loginHint)
                : try await silentRefresh(loginHint: loginHint)
        } catch let error as AuthError {
            return .failure(error.code)
        } catch {
            return .failure("sign_in_failed")
        }
    }

    // MARK: - Interactive

    private func interactiveSignIn(loginHint: String?) async throws -> AuthorizeResponse {
        let pkce = PKCE.random()
        let state = UUID().uuidString
        let url = config.authorizationURL(
            pkce: pkce, state: state, interactive: true, loginHint: loginHint
        )
        let callback = try await presentAuthSession(url: url)
        let code = try authorizationCode(from: callback, expectedState: state)

        let token = try await exchange(
            TokenEndpoint.codeExchangeRequest(config: config, code: code, verifier: pkce.verifier)
        )
        guard let refreshToken = token.refreshToken else { throw AuthError("no_refresh_token") }
        let email = token.idToken.flatMap(IDToken.email(from:))
        if let email { store.setRefreshToken(refreshToken, forEmail: email) }
        return .success(googleToken(from: token, email: email))
    }

    // MARK: - Silent

    private func silentRefresh(loginHint: String?) async throws -> AuthorizeResponse {
        guard let email = loginHint, !email.isEmpty,
              let refreshToken = store.refreshToken(forEmail: email)
        else { throw AuthError("consent_required") }

        let token = try await exchange(
            TokenEndpoint.refreshRequest(config: config, refreshToken: refreshToken)
        )
        // A refresh may rotate the refresh token; persist a replacement if sent.
        if let rotated = token.refreshToken { store.setRefreshToken(rotated, forEmail: email) }
        return .success(googleToken(from: token, email: email))
    }

    // MARK: - Helpers

    private func exchange(_ request: URLRequest) async throws -> TokenResponse {
        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            // A 400 with invalid_grant means the refresh token was revoked; the
            // caller surfaces this as needing an interactive reconnect.
            throw AuthError("token_endpoint_error")
        }
        guard let token = try? JSONDecoder().decode(TokenResponse.self, from: data) else {
            throw AuthError("token_decode_failed")
        }
        return token
    }

    private func googleToken(from token: TokenResponse, email: String?) -> GoogleToken {
        GoogleToken(
            accessToken: token.accessToken,
            expiresAt: token.expiresAtMillis(now: Date()),
            email: email
        )
    }

    private func authorizationCode(from callback: URL, expectedState: String) throws -> String {
        let query = URLComponents(url: callback, resolvingAgainstBaseURL: false)?.queryItems ?? []
        let values = Dictionary(query.map { ($0.name, $0.value ?? "") }, uniquingKeysWith: { a, _ in a })
        if let error = values["error"] { throw AuthError(error) }
        // Reject a callback whose state does not echo ours, so a forged redirect
        // cannot inject a code.
        guard values["state"] == expectedState else { throw AuthError("state_mismatch") }
        guard let code = values["code"], !code.isEmpty else { throw AuthError("no_code") }
        return code
    }

    private func presentAuthSession(url: URL) async throws -> URL {
        let scheme = String(config.redirectURI.prefix { $0 != ":" })
        return try await withCheckedThrowingContinuation { continuation in
            let session = ASWebAuthenticationSession(
                url: url, callbackURLScheme: scheme
            ) { callback, error in
                if let callback { continuation.resume(returning: callback) }
                else { continuation.resume(throwing: AuthError(cancelCode(error))) }
            }
            session.presentationContextProvider = self
            // A first-run sign-in has no cookies to share; keep it ephemeral so the
            // account chooser always appears rather than silently reusing one.
            session.prefersEphemeralWebBrowserSession = false
            if !session.start() { continuation.resume(throwing: AuthError("session_start_failed")) }
        }
    }
}

extension GoogleAuthService: ASWebAuthenticationPresentationContextProviding {
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        // A menu-bar app may have no key window; fall back to a transient anchor.
        NSApp.keyWindow ?? NSApp.windows.first ?? ASPresentationAnchor()
    }
}

/// A small typed error whose `code` is what the browser receives as the failure
/// reason. It is advisory only; the extension treats any failure the same.
struct AuthError: Error {
    let code: String
    init(_ code: String) { self.code = code }
}

/// A user-cancelled sheet is the common, expected failure; label it distinctly.
private func cancelCode(_ error: Error?) -> String {
    if let error = error as? ASWebAuthenticationSessionError, error.code == .canceledLogin {
        return "cancelled"
    }
    return "sign_in_failed"
}
