import XCTest
@testable import CommandCenterCore

final class CalendarFeedTests: XCTestCase {
    private let start = Date(timeIntervalSince1970: 1_800_000_000)
    private let end = Date(timeIntervalSince1970: 1_800_001_800)

    private func event(
        url: String? = nil,
        location: String? = nil,
        notes: String? = nil
    ) -> CalendarEventInput {
        CalendarEventInput(
            id: "e1", title: "Design review", start: start, end: end,
            location: location, notes: notes, url: url,
            calendarName: "Work", calendarColorHex: "#4285F4", attendeeNames: ["Ada", "Grace"]
        )
    }

    func testDetectsMeetFromUrlField() {
        let meeting = detectMeeting(in: event(url: "https://meet.google.com/abc-defg-hij"))
        XCTAssertEqual(meeting?.platform, "meet")
    }

    func testDetectsZoomSubdomainFromLocation() {
        let meeting = detectMeeting(in: event(location: "https://acme.zoom.us/j/123"))
        XCTAssertEqual(meeting?.platform, "zoom")
    }

    func testDetectsTeamsFromNotesText() {
        let meeting = detectMeeting(in: event(notes: "Join here: https://teams.microsoft.com/l/meetup-join/x see you"))
        XCTAssertEqual(meeting?.platform, "teams")
    }

    func testNoMeetingForANonConferenceUrl() {
        XCTAssertNil(detectMeeting(in: event(url: "https://example.com/page")))
    }

    func testBuildsAValidCalendarFeed() {
        let envelope = calendarFeedEnvelope(
            events: [event(url: "https://meet.google.com/abc")],
            day: "2026-06-14", timeZone: "America/Los_Angeles",
            updatedAt: "2026-06-14T15:04:05Z"
        )
        let data = try! JSONEncoder().encode(envelope)

        guard case .success(let feed) = decodeFeedEnvelope(data) else {
            return XCTFail("calendar feed should decode")
        }
        XCTAssertEqual(feed.kind, "calendar.today")
        XCTAssertEqual(feed.providerId, "command-center-apple")
        XCTAssertFalse(feed.glance.value.isEmpty)
        let firstEvent = feed.data?.objectValue?["events"]?.arrayValue?.first?.objectValue
        XCTAssertEqual(firstEvent?["meeting"]?.objectValue?["platform"]?.stringValue, "meet")
    }

    func testEmptyDayStillHasAGlance() {
        let envelope = calendarFeedEnvelope(
            events: [], day: "2026-06-14", timeZone: "UTC", updatedAt: "2026-06-14T15:04:05Z"
        )
        XCTAssertEqual(envelope.objectValue?["glance"]?.objectValue?["value"]?.stringValue, "0")
    }

    func testPublishesThroughTheContainerAndFeedStoreReadsItBack() throws {
        let container = try makeTempContainer()
        let publisher = FeedPublisher(providerId: appleCalendarProviderId, containerURL: container)
        try publisher.writeManifest(appleCalendarManifest())
        try publisher.writeFeed(
            calendarFeedEnvelope(
                events: [event(url: "https://meet.google.com/abc")],
                day: "2026-06-14", timeZone: "UTC", updatedAt: "2026-06-14T15:04:05Z"
            ),
            to: "calendar/today.json"
        )

        let providers = FeedStore(containerURL: container, locator: AllInstalledLocator()).loadProviders()
        XCTAssertEqual(providers.count, 1)
        XCTAssertEqual(providers.first?.feeds.first?.kind, "calendar.today")
    }
}
