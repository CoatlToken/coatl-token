// MockPriceFeed for testing
// filepath: c:\Projects\Coatl\public-github\coatl-token\contracts\MockPriceFeed.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

contract MockPriceFeed {
    int256 public answer;

    constructor(int256 _answer) {
        answer = _answer;
    }

    function latestAnswer() external view returns (int256) {
        return answer;
    }

    function setAnswer(int256 _answer) external {
        answer = _answer;
    }
}