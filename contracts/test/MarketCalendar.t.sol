// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {BokkyPooBahsDateTimeLibrary as DT} from "datetime/BokkyPooBahsDateTimeLibrary.sol";
import {MarketCalendar} from "../src/MarketCalendar.sol";

contract MarketCalendarTest is Test {
    MarketCalendar cal;

    function setUp() public {
        cal = new MarketCalendar(address(this));
        cal.setHoliday(2026, 11, 26, true); // Thanksgiving
    }

    function utc(uint256 y, uint256 mo, uint256 d, uint256 h, uint256 mi) internal pure returns (uint256) {
        return DT.timestampFromDateTime(y, mo, d, h, mi, 0);
    }

    // Daylight time: 20:00 EDT == 00:00 UTC next day.
    function test_SummerWeekendClosure() public view {
        assertTrue(cal.isOpen(utc(2026, 9, 18, 23, 59)), "Fri 19:59 EDT open");
        assertFalse(cal.isOpen(utc(2026, 9, 19, 0, 0)), "Fri 20:00 EDT closed");
        assertFalse(cal.isOpen(utc(2026, 9, 20, 12, 0)), "Sun midday closed");
        assertFalse(cal.isOpen(utc(2026, 9, 20, 23, 59)), "Sun 19:59 EDT closed");
        assertTrue(cal.isOpen(utc(2026, 9, 21, 0, 0)), "Sun 20:00 EDT open");
    }

    // Standard time: 20:00 EST == 01:00 UTC next day.
    function test_WinterWeekendClosure() public view {
        assertTrue(cal.isOpen(utc(2026, 12, 5, 0, 59)), "Fri 19:59 EST open");
        assertFalse(cal.isOpen(utc(2026, 12, 5, 1, 0)), "Fri 20:00 EST closed");
        assertTrue(cal.isOpen(utc(2026, 12, 7, 1, 0)), "Sun 20:00 EST open");
    }

    function test_NextOpenAndLastClose() public view {
        uint256 saturday = utc(2026, 9, 19, 15, 0);
        assertEq(cal.nextOpen(saturday), utc(2026, 9, 21, 0, 0));
        assertEq(cal.lastClose(saturday), utc(2026, 9, 19, 0, 0));
        uint256 tuesday = utc(2026, 9, 22, 15, 0);
        assertEq(cal.nextOpen(tuesday), utc(2026, 9, 22, 0, 0), "inside a session returns its start");
    }

    function test_HolidayClosesItsSession() public view {
        // Thanksgiving session would run Wed 20:00 EST -> Thu 20:00 EST.
        assertTrue(cal.isOpen(utc(2026, 11, 26, 0, 59)), "Wed 19:59 EST open");
        assertFalse(cal.isOpen(utc(2026, 11, 26, 1, 0)), "Wed 20:00 EST closed");
        assertFalse(cal.isOpen(utc(2026, 11, 26, 18, 0)), "Thanksgiving closed");
        assertTrue(cal.isOpen(utc(2026, 11, 27, 1, 0)), "Thu 20:00 EST reopens");
        assertEq(cal.nextOpen(utc(2026, 11, 26, 18, 0)), utc(2026, 11, 27, 1, 0));
    }

    // DST starts Sun 2026-03-08 02:00 EST; the Sunday-evening open is already in EDT.
    function test_DstStartWeekend() public view {
        assertFalse(cal.isOpen(utc(2026, 3, 7, 12, 0)), "Saturday closed");
        assertEq(cal.nextOpen(utc(2026, 3, 7, 12, 0)), utc(2026, 3, 9, 0, 0), "Sun 20:00 EDT");
        assertEq(cal.lastClose(utc(2026, 3, 7, 12, 0)), utc(2026, 3, 7, 1, 0), "Fri 20:00 EST");
    }

    function test_OnlyOwnerSetsHolidays() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert();
        cal.setHoliday(2026, 12, 25, true);
    }

    /// Every instant is either open, or has a next open within the lookahead that is in the future.
    function testFuzz_NextOpenIsAfterClosedInstant(uint256 ts) public view {
        ts = bound(ts, utc(2026, 1, 1, 0, 0), utc(2030, 1, 1, 0, 0));
        if (cal.isOpen(ts)) return;
        uint256 open = cal.nextOpen(ts);
        assertGt(open, ts);
        assertTrue(cal.isOpen(open));
        assertFalse(cal.isOpen(open - 1));
    }
}
