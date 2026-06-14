import Foundation
import SafariServices
import os.log

/// The native bridge for the Safari extension. This runs in the extension's app
/// extension process and can read the App Group container. For now it answers
/// with a minimal ack; the real getDashboard composition (reading providers and
/// settings via CommandCenterCore's FeedStore) is wired in P2.3.
final class SafariWebExtensionHandler: NSObject, NSExtensionRequestHandling {
    func beginRequest(with context: NSExtensionContext) {
        let response = NSExtensionItem()
        response.userInfo = [SFExtensionMessageKey: ["ok": true]]
        context.completeRequest(returningItems: [response], completionHandler: nil)
    }
}
