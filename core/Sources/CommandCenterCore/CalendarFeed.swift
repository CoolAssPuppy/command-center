import Foundation

/// Pure, EventKit-agnostic mapping from calendar events to a calendar.today
/// feed, plus meeting-link detection. The app converts EKEvent into
/// CalendarEventInput and calls this; all the logic worth testing lives here.
/// Meeting detection only surfaces known conferencing hosts. The feed is
/// display data only.

public let appleCalendarProviderId = "command-center-apple"

public struct CalendarEventInput: Equatable {
    public var id: String
    public var title: String
    public var start: Date
    public var end: Date
    public var isAllDay: Bool
    public var location: String?
    public var notes: String?
    public var url: String?
    public var calendarName: String?
    public var calendarColorHex: String?
    public var attendeeNames: [String]

    public init(
        id: String,
        title: String,
        start: Date,
        end: Date,
        isAllDay: Bool = false,
        location: String? = nil,
        notes: String? = nil,
        url: String? = nil,
        calendarName: String? = nil,
        calendarColorHex: String? = nil,
        attendeeNames: [String] = []
    ) {
        self.id = id
        self.title = title
        self.start = start
        self.end = end
        self.isAllDay = isAllDay
        self.location = location
        self.notes = notes
        self.url = url
        self.calendarName = calendarName
        self.calendarColorHex = calendarColorHex
        self.attendeeNames = attendeeNames
    }
}

public struct DetectedMeeting: Equatable {
    public let url: String
    public let platform: String
}

private func meetingFromURLString(_ raw: String) -> DetectedMeeting? {
    guard let url = URL(string: raw),
          let platform = MeetingHosts.platform(forHost: url.host) else {
        return nil
    }
    return DetectedMeeting(url: raw, platform: platform)
}

private func meetingInText(_ text: String?) -> DetectedMeeting? {
    guard let text, !text.isEmpty else { return nil }
    let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
    let range = NSRange(text.startIndex..., in: text)
    var found: DetectedMeeting?
    detector?.enumerateMatches(in: text, options: [], range: range) { match, _, stop in
        if let url = match?.url, let platform = MeetingHosts.platform(forHost: url.host) {
            found = DetectedMeeting(url: url.absoluteString, platform: platform)
            stop.pointee = true
        }
    }
    return found
}

/// Detect a conference link by scanning, in order, the url field, the location,
/// and the notes. Returns the first known meeting host found.
public func detectMeeting(in event: CalendarEventInput) -> DetectedMeeting? {
    if let raw = event.url, let meeting = meetingFromURLString(raw) { return meeting }
    if let meeting = meetingInText(event.location) { return meeting }
    return meetingInText(event.notes)
}

private func isoString(_ date: Date) -> String {
    ISO8601.formatter.string(from: date)
}

private func clockString(_ date: Date, timeZone: String) -> String {
    let formatter = DateFormatter()
    formatter.locale = Locale(identifier: "en_US_POSIX")
    formatter.dateFormat = "h:mm"
    formatter.timeZone = TimeZone(identifier: timeZone) ?? TimeZone(identifier: "UTC")
    return formatter.string(from: date)
}

private func eventJSON(_ event: CalendarEventInput) -> JSONValue {
    var object: [String: JSONValue] = [
        "id": .string(event.id),
        "title": .string(event.title),
        "start": .string(isoString(event.start)),
        "end": .string(isoString(event.end)),
        "allDay": .bool(event.isAllDay),
        "attendeeCount": .number(Double(event.attendeeNames.count)),
    ]
    if let location = event.location { object["location"] = .string(location) }
    if let name = event.calendarName { object["calendarName"] = .string(name) }
    if let color = event.calendarColorHex { object["calendarColorHex"] = .string(color) }
    if !event.attendeeNames.isEmpty {
        object["attendeeNames"] = .array(event.attendeeNames.map { .string($0) })
    }
    if let meeting = detectMeeting(in: event) {
        object["meeting"] = .object([
            "url": .string(meeting.url),
            "platform": .string(meeting.platform),
        ])
    }
    return .object(object)
}

private func calendarGlance(_ sorted: [CalendarEventInput], timeZone: String) -> JSONValue {
    guard let first = sorted.first else {
        return .object(["value": .string("0"), "label": .string("events")])
    }
    return .object([
        "value": .string(clockString(first.start, timeZone: timeZone)),
        "label": .string(first.title.isEmpty ? "event" : first.title),
    ])
}

/// Build a calendar.today feed envelope (as JSON) from today's events.
public func calendarFeedEnvelope(
    events: [CalendarEventInput],
    day: String,
    timeZone: String,
    updatedAt: String
) -> JSONValue {
    let sorted = events.sorted { $0.start < $1.start }
    let data: JSONValue = .object([
        "day": .string(day),
        "timeZone": .string(timeZone),
        "events": .array(sorted.map(eventJSON)),
    ])
    return .object([
        "schemaVersion": .number(1),
        "providerId": .string(appleCalendarProviderId),
        "kind": .string("calendar.today"),
        "updatedAt": .string(updatedAt),
        "ttlSeconds": .number(120),
        "status": .string("ok"),
        "glance": calendarGlance(sorted, timeZone: timeZone),
        "data": data,
    ])
}

/// The manifest for the Apple-calendar provider (Command Center publishing its
/// own EventKit data through the same contract as third-party providers).
public func appleCalendarManifest() -> JSONValue {
    let feed: JSONValue = .object([
        "kind": .string("calendar.today"),
        "path": .string("calendar/today.json"),
    ])
    let joinAction: JSONValue = .object([
        "id": .string("join"),
        "route": .string("commandcenter://join"),
    ])
    return .object([
        "schemaVersion": .number(1),
        "providerId": .string(appleCalendarProviderId),
        "displayName": .string("Calendar"),
        "bundleId": .string("com.strategicnerds.commandcenter"),
        "icon": .string("calendar"),
        "accentColorHex": .string("#34C759"),
        "feeds": .array([feed]),
        "actions": .array([joinAction]),
    ])
}
