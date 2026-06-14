import XCTest
@testable import CommandCenterCore

final class IngestWireTests: XCTestCase {
    func testFrameThenDecodeLengthRoundTrips() {
        let payload = Data("hello".utf8)
        let framed = IngestWire.frame(payload)

        XCTAssertEqual(framed.count, 4 + payload.count)
        XCTAssertEqual(IngestWire.decodeLength(framed.prefix(4)), payload.count)
        XCTAssertEqual(framed.dropFirst(4), payload)
    }

    func testDecodeLengthRejectsAWrongPrefixSize() {
        XCTAssertNil(IngestWire.decodeLength(Data([0, 0, 1])))
        XCTAssertNil(IngestWire.decodeLength(Data([0, 0, 0, 1, 2])))
    }

    func testDecodeLengthRejectsZeroAndOversized() {
        XCTAssertNil(IngestWire.decodeLength(Data([0, 0, 0, 0])))

        let tooBig = IngestWire.maxMessageBytes + 1
        let prefix = Data([
            UInt8(tooBig >> 24 & 0xFF), UInt8(tooBig >> 16 & 0xFF),
            UInt8(tooBig >> 8 & 0xFF), UInt8(tooBig & 0xFF),
        ])
        XCTAssertNil(IngestWire.decodeLength(prefix))
    }

    func testAcceptsAMessageAtTheCap() {
        let atCap = IngestWire.maxMessageBytes
        let prefix = Data([
            UInt8(atCap >> 24 & 0xFF), UInt8(atCap >> 16 & 0xFF),
            UInt8(atCap >> 8 & 0xFF), UInt8(atCap & 0xFF),
        ])
        XCTAssertEqual(IngestWire.decodeLength(prefix), atCap)
    }
}
