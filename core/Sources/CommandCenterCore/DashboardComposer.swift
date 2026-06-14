import Foundation

/// Builds the getDashboard payload the dashboard expects: the installed
/// providers from the FeedStore, the opaque settings, and a generatedAt stamp.
/// This is the one call the Safari extension handler makes between reading the
/// container and answering the dashboard. It only assembles finished, display
/// data: no token, no secret, ever crosses this boundary.
public struct DashboardComposer {
    private let source: ProviderSource

    public init(source: ProviderSource) {
        self.source = source
    }

    public func compose(generatedAt: String) -> DashboardPayload {
        DashboardPayload(
            settings: source.loadSettings(),
            providers: source.loadProviders(),
            generatedAt: generatedAt
        )
    }

    /// The payload serialized to JSON, ready to return over native messaging.
    public func composeJSON(generatedAt: String) -> Data {
        let payload = compose(generatedAt: generatedAt)
        return (try? JSONEncoder().encode(payload)) ?? Data(#"{"providers":[]}"#.utf8)
    }
}
