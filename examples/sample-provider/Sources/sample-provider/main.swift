import CommandCenterKit
import Foundation
import SampleProvider

// Usage: sample-provider [output-directory]
// With no argument, publishes into the well-known Command Center directory.
let container = CommandLine.arguments.count > 1
    ? URL(fileURLWithPath: CommandLine.arguments[1])
    : FileDropTransport.wellKnownContainerURL()

do {
    try await SampleProvider.publish(to: container)
    print("Published \(SampleProvider.displayName) to \(container.path)")
} catch {
    print("Failed to publish: \(error)")
    exit(1)
}
