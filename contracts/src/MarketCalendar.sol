// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BokkyPooBahsDateTimeLibrary as DT} from "datetime/BokkyPooBahsDateTimeLibrary.sol";

/// @title MarketCalendar
/// @notice Knows when US tokenized-equity feeds are live. Robinhood's 24/5 market runs from
/// Sunday 20:00 ET to Friday 20:00 ET. We model that as "trading days": trading day D runs from
/// 20:00 ET on D-1 to 20:00 ET on D, and is open when D is a weekday and not a market holiday.
/// Shifting Eastern time forward by 4 hours therefore maps any instant to its trading day.
contract MarketCalendar is Ownable {
    uint256 private constant HOUR = 1 hours;
    uint256 private constant DAY = 1 days;
    /// @dev Session boundary is 20:00 ET, i.e. 4 hours before midnight.
    uint256 private constant SESSION_SHIFT = 4 hours;
    uint256 private constant MAX_LOOKAHEAD_DAYS = 14;

    /// @notice Trading days (as Eastern-calendar day numbers since epoch) with no session.
    mapping(uint256 day => bool) public isHoliday;

    event HolidaySet(uint256 indexed year, uint256 indexed month, uint256 indexed day, bool closed);

    error NoOpenSessionAhead();

    constructor(address owner_) Ownable(owner_) {}

    /// @notice Mark or unmark a full-day market closure, given in Eastern calendar date.
    function setHoliday(uint256 year, uint256 month, uint256 day, bool closed) external onlyOwner {
        isHoliday[DT._daysFromDate(year, month, day)] = closed;
        emit HolidaySet(year, month, day, closed);
    }

    /// @notice True when the 24/5 session covering `ts` is open.
    function isOpen(uint256 ts) public view returns (bool) {
        return _isTradingDay(tradingDayOf(ts));
    }

    /// @notice Eastern-calendar day number of the trading day that contains `ts`.
    function tradingDayOf(uint256 ts) public pure returns (uint256) {
        return (ts - _etOffset(ts) + SESSION_SHIFT) / DAY;
    }

    /// @notice UTC timestamp at which the next session opens, strictly after `ts` is closed.
    /// If `ts` is inside an open session this returns that session's opening time.
    function nextOpen(uint256 ts) external view returns (uint256) {
        uint256 day = tradingDayOf(ts);
        if (_isTradingDay(day)) return sessionStart(day);
        for (uint256 i = 1; i <= MAX_LOOKAHEAD_DAYS; ++i) {
            if (_isTradingDay(day + i)) return sessionStart(day + i);
        }
        revert NoOpenSessionAhead();
    }

    /// @notice UTC timestamp at which the current session closed, for an instant inside a closure.
    function lastClose(uint256 ts) external view returns (uint256) {
        uint256 day = tradingDayOf(ts);
        while (!_isTradingDay(day)) --day;
        return sessionStart(day + 1);
    }

    /// @notice UTC start (20:00 ET on the previous calendar day) of trading day `day`.
    function sessionStart(uint256 day) public pure returns (uint256) {
        uint256 etStart = day * DAY - SESSION_SHIFT;
        // Resolve the offset at the session start itself; DST switches happen at 02:00 local,
        // never at 20:00, so one refinement pass is exact.
        uint256 guess = etStart + 5 * HOUR;
        return etStart + _etOffset(guess);
    }

    function _isTradingDay(uint256 day) internal view returns (bool) {
        // Day 0 (1970-01-01) was a Thursday; getDayOfWeek returns 1 = Monday ... 7 = Sunday.
        uint256 dow = DT.getDayOfWeek(day * DAY);
        return dow <= 5 && !isHoliday[day];
    }

    /// @dev Seconds Eastern time lags UTC at instant `ts`: 4h in daylight time, otherwise 5h.
    /// US daylight time runs from the second Sunday of March 02:00 EST (07:00 UTC)
    /// to the first Sunday of November 02:00 EDT (06:00 UTC).
    function _etOffset(uint256 ts) internal pure returns (uint256) {
        uint256 year = DT.getYear(ts);
        uint256 dstStart = _nthSunday(year, 3, 2) + 7 * HOUR;
        uint256 dstEnd = _nthSunday(year, 11, 1) + 6 * HOUR;
        return ts >= dstStart && ts < dstEnd ? 4 * HOUR : 5 * HOUR;
    }

    /// @dev Midnight UTC of the n-th Sunday of `month`.
    function _nthSunday(uint256 year, uint256 month, uint256 n) internal pure returns (uint256) {
        uint256 first = DT.timestampFromDate(year, month, 1);
        uint256 dow = DT.getDayOfWeek(first);
        uint256 toSunday = (7 - dow) % 7;
        return first + (toSunday + 7 * (n - 1)) * DAY;
    }
}
