// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MirroredFeed} from "../src/MirroredFeed.sol";

contract MirroredFeedTest is Test {
    MirroredFeed feed;

    function setUp() public {
        feed = new MirroredFeed(address(this), 8, "RHNVDA / USD (mirror)");
    }

    function test_MirrorsRoundsWithOriginalTimestamps() public {
        feed.mirror(180e8, 1000, 1001);
        feed.mirror(181e8, 2000, 2002);
        (uint80 id, int256 answer,, uint256 updatedAt,) = feed.latestRoundData();
        assertEq(id, 2);
        assertEq(answer, 181e8);
        assertEq(updatedAt, 2002);
        (, answer,,,) = feed.getRoundData(1);
        assertEq(answer, 180e8);
    }

    function test_OnlyOwnerWrites() public {
        vm.prank(address(0xBAD));
        vm.expectRevert();
        feed.mirror(1, 1, 1);
    }

    function test_RejectsTimeTravel() public {
        feed.mirror(180e8, 1000, 1000);
        vm.expectRevert(MirroredFeed.NonMonotonic.selector);
        feed.mirror(180e8, 999, 999);
    }

    function test_UnknownRoundReverts() public {
        vm.expectRevert(MirroredFeed.RoundNotFound.selector);
        feed.getRoundData(7);
    }
}
