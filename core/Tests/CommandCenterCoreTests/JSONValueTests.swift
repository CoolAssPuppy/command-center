import XCTest
@testable import CommandCenterCore

final class JSONValueTests: XCTestCase {
    func testRoundTripsAnArbitraryJsonObject() throws {
        let source = """
        { "a": "x", "b": 2, "c": true, "d": null, "e": [1, 2], "f": { "g": "h" } }
        """
        let value = try JSONDecoder().decode(JSONValue.self, from: Data(source.utf8))
        let reencoded = try JSONEncoder().encode(value)
        let again = try JSONDecoder().decode(JSONValue.self, from: reencoded)

        XCTAssertEqual(value, again)
    }

    func testDistinguishesBoolFromNumber() throws {
        let value = try JSONDecoder().decode(JSONValue.self, from: Data("true".utf8))
        XCTAssertEqual(value, .bool(true))

        let number = try JSONDecoder().decode(JSONValue.self, from: Data("1".utf8))
        XCTAssertEqual(number, .number(1))
    }

    func testAccessors() throws {
        let value = try JSONDecoder().decode(
            JSONValue.self,
            from: Data("{ \"items\": [\"a\"] }".utf8)
        )
        XCTAssertEqual(value.objectValue?["items"]?.arrayValue?.first?.stringValue, "a")
    }
}
