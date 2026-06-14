import AppKit
import CommandCenterCore
import EventKit
import Foundation

/// Thin EventKit wrapper. It converts EKEvents into the EventKit-agnostic
/// CalendarEventInput and publishes a calendar.today feed via CommandCenterCore.
/// All mapping and meeting detection live in core. It never prompts at launch:
/// refreshIfAuthorized publishes only when access is already granted.
@MainActor
final class EventKitCalendarProvider {
    private let store = EKEventStore()

    func refreshIfAuthorized() {
        guard EKEventStore.authorizationStatus(for: .event) == .fullAccess else { return }
        publishToday()
    }

    func requestAccessThenRefresh() {
        store.requestFullAccessToEvents { [weak self] granted, _ in
            guard granted else { return }
            Task { @MainActor in self?.publishToday() }
        }
    }

    private func publishToday() {
        guard let container = CommandCenterContainer.url() else { return }
        let calendar = Calendar.current
        let startOfDay = calendar.startOfDay(for: Date())
        guard let endOfDay = calendar.date(byAdding: .day, value: 1, to: startOfDay) else { return }

        let predicate = store.predicateForEvents(withStart: startOfDay, end: endOfDay, calendars: nil)
        let inputs = store.events(matching: predicate).map(Self.toInput)

        let dayFormatter = DateFormatter()
        dayFormatter.locale = Locale(identifier: "en_US_POSIX")
        dayFormatter.dateFormat = "yyyy-MM-dd"

        let envelope = calendarFeedEnvelope(
            events: inputs,
            day: dayFormatter.string(from: startOfDay),
            timeZone: TimeZone.current.identifier,
            updatedAt: ISO8601.formatter.string(from: Date())
        )
        let manifest = appleCalendarManifest()

        // Keep file I/O off the main thread; envelope/manifest are Sendable.
        Task.detached(priority: .utility) {
            let publisher = FeedPublisher(providerId: appleCalendarProviderId, containerURL: container)
            do {
                try publisher.writeManifest(manifest)
                try publisher.writeFeed(envelope, to: "calendar/today.json")
            } catch {
                NSLog("CommandCenter: calendar publish failed: \(error)")
            }
        }
    }

    private static func toInput(_ event: EKEvent) -> CalendarEventInput {
        CalendarEventInput(
            id: event.eventIdentifier ?? UUID().uuidString,
            title: event.title ?? "",
            start: event.startDate ?? Date(),
            end: event.endDate ?? Date(),
            isAllDay: event.isAllDay,
            location: event.location,
            notes: event.notes,
            url: event.url?.absoluteString,
            calendarName: event.calendar?.title,
            calendarColorHex: hex(event.calendar?.cgColor),
            attendeeNames: event.attendees?.compactMap { $0.name } ?? []
        )
    }

    private static func hex(_ cgColor: CGColor?) -> String? {
        guard let cgColor,
              let color = NSColor(cgColor: cgColor)?.usingColorSpace(.sRGB) else {
            return nil
        }
        let red = Int((color.redComponent * 255).rounded())
        let green = Int((color.greenComponent * 255).rounded())
        let blue = Int((color.blueComponent * 255).rounded())
        return String(format: "#%02X%02X%02X", red, green, blue)
    }
}
