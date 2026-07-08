import CommandCenterAuth
import Foundation
import os.log
import SafariServices

/// The native bridge for the Safari extension. The new tab page has no
/// chrome.identity, so for Google sign-in it sends { type: "google-authorize" }
/// here; this handler forwards it to the container app over the loopback and
/// returns the app's token reply. The handler holds no secret and makes no OAuth
/// decision — it is a thin, well-bounded relay. Any other message type gets a
/// benign { ok: true } so the page can probe the bridge cheaply.
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    /// The container app's bundle id, launched on demand so a fresh browser
    /// session can sign in without the user opening the app first.
    private static let appBundleID = "com.strategicnerds.commandcenter"

    func beginRequest(with context: NSExtensionContext) {
        let message = Self.message(from: context)
        let type = message?["type"] as? String ?? ""

        guard type == "google-authorize" else {
            Self.complete(context, with: ["ok": true])
            return
        }

        let request = AuthorizeRequest(
            interactive: message?["interactive"] as? Bool ?? false,
            loginHint: message?["loginHint"] as? String
        )

        Task {
            let response = await Self.authorize(request)
            Self.complete(context, with: Self.dictionary(from: response))
        }
    }

    // MARK: - Loopback relay

    private static func authorize(_ request: AuthorizeRequest) async -> AuthorizeResponse {
        await ensureAppRunning()
        guard let payload = try? JSONEncoder().encode(request) else {
            return .failure("encode_failed")
        }
        do {
            let responseData = try await LoopbackClient().send(payload)
            return AuthorizeCoding.decodeResponse(responseData) ?? .failure("bad_response")
        } catch {
            // The app is not answering the loopback (not installed, not launched,
            // or blocked). The page treats this the same as a declined sign-in.
            os_log(.error, "Command Center: native auth unreachable")
            return .failure("native_unreachable")
        }
    }

    /// Launch the container app if it is not already running, then give it a
    /// moment to bind the loopback before the first connection attempt.
    private static func ensureAppRunning() async {
        let running = NSRunningApplication
            .runningApplications(withBundleIdentifier: appBundleID)
            .isEmpty == false
        guard !running else { return }

        guard let appURL = NSWorkspace.shared.urlForApplication(withBundleIdentifier: appBundleID) else {
            return
        }
        let configuration = NSWorkspace.OpenConfiguration()
        configuration.activates = false
        _ = try? await NSWorkspace.shared.openApplication(at: appURL, configuration: configuration)
        try? await Task.sleep(nanoseconds: 400_000_000)
    }

    // MARK: - SFExtension plumbing

    private static func message(from context: NSExtensionContext) -> [String: Any]? {
        let item = context.inputItems.first as? NSExtensionItem
        return item?.userInfo?[SFExtensionMessageKey] as? [String: Any]
    }

    private static func complete(_ context: NSExtensionContext, with body: [String: Any]) {
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: body]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

    /// Re-encode the typed response into the plain dictionary Safari hands to JS,
    /// keeping the exact { ok, token: { accessToken, expiresAt, email } } shape the
    /// TypeScript bridge validates.
    private static func dictionary(from response: AuthorizeResponse) -> [String: Any] {
        let data = AuthorizeCoding.encode(response)
        return (try? JSONSerialization.jsonObject(with: data)) as? [String: Any] ?? ["ok": false]
    }
}
