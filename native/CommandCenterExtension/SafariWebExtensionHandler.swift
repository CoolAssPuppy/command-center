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
        guard let container = CommandCenterContainer.url() else {
            return ["providers": []]
        }
        let composer = DashboardComposer(
            feedStore: FeedStore(containerURL: container, locator: WorkspaceProviderLocator())
        )
        let json = composer.composeJSON(generatedAt: ISO8601DateFormatter().string(from: Date()))
        return (try? JSONSerialization.jsonObject(with: json)) ?? ["providers": []]
    }
}
