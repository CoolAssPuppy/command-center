import CommandCenterCore
import Foundation
import SafariServices

/// The native bridge for the Safari extension. It runs in the extension process,
/// which can read the App Group container. The dashboard sends { "type": ... };
/// for "getDashboard" the handler reads the container via the FeedStore and
/// answers with the composed payload. All real logic lives in CommandCenterCore
/// (DashboardComposer); this handler is thin glue. It forwards only display
/// data, never a token.
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let item = context.inputItems.first as? NSExtensionItem
        let message = item?.userInfo?[SFExtensionMessageKey] as? [String: Any]
        let type = message?["type"] as? String ?? ""

        let body: Any
        switch type {
        case "getDashboard":
            body = dashboardResponse()
        default:
            body = ["ok": true]
        }

        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: body]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }

    private func dashboardResponse() -> Any {
        // Discover providers across both roots: the App Group container (the
        // first-party suite) and the well-known directory the file-drop SDK
        // writes to. App Group wins on a providerId collision.
        var roots: [URL] = []
        if let group = CommandCenterContainer.url() { roots.append(group) }
        roots.append(CommandCenterContainer.wellKnownDirectoryURL())

        let source = MultiRootFeedStore(containerURLs: roots, locator: WorkspaceProviderLocator())
        let composer = DashboardComposer(source: source)
        let json = composer.composeJSON(generatedAt: ISO8601.formatter.string(from: Date()))
        return (try? JSONSerialization.jsonObject(with: json)) ?? ["providers": []]
    }
}
