// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IPriceFeed {
    function latestAnswer() external view returns (int256);
}

/**
 * @title Coatl ICO Contract
 * @notice Handles the initial coin offering (ICO) for the Coatl token with softcap, hardcap, dynamic ETH/USD pricing, and refund logic.
 * @dev
 * - Accepts ETH contributions in exchange for tokens at a USD-pegged price (10 cents per token, using Chainlink ETH/USD).
 * - ICO runs between a start and end timestamp.
 * - If softcap is reached, funds can be released to the project before the end date, but ICO continues until hardcap or end.
 * - If softcap is not reached by the end, contributors can claim refunds.
 * - Tokens are transferred immediately upon purchase.
 * - Owner can recover unsold tokens after ICO ends.
 * @custom:security-contact security@coatl.one
 */
contract ICO is Ownable, ReentrancyGuard {
    // --- State Variables ---
    IERC20 public immutable token;
    IPriceFeed public immutable priceFeed; // Chainlink ETH/USD price feed

    uint256 public immutable softCap; // in tokens (18 decimals)
    uint256 public immutable hardCap; // in tokens (18 decimals)
    uint256 public immutable start;
    uint256 public immutable end;
    uint256 public constant TOKEN_USD_PRICE = 10; // 10 cents
    uint256 public constant MIN_CONTRIBUTION_USD = 500; // $5.00 in cents
    uint256 public constant MAX_CONTRIBUTION_USD = 100000000; // $1,000,000.00 in cents

    uint256 public totalRaised;
    uint256 public totalTokensSold;
    bool public softCapReached;
    bool public finalized;
    bool public started;

    bool public icoEndedEventEmitted;

    mapping(address => uint256) public contributions;
    mapping(address => uint256) public tokensPurchased;

    address public immutable projectWallet;

    // --- Events ---
    event TokensPurchased(address indexed buyer, uint256 ethAmount, uint256 tokenAmount);
    event FundsReleased(address indexed to, uint256 amount);
    event RefundClaimed(address indexed buyer, uint256 amount);
    event ICOStarted(uint256 start, uint256 end, uint256 softCap, uint256 hardCap);
    event ICOEnded(bool successful, uint256 totalRaised);
    event UnsoldTokensRecovered(address indexed to, uint256 amount);
    event Finalized();
    event EmergencyWithdraw(address indexed to, uint256 amount);
    event ICOCreated(uint256 start, uint256 end, uint256 softCap, uint256 hardCap);

    // --- Custom Errors ---
    error ZeroAddressNotAllowed();
    error InvalidCaps();
    error InvalidTimeWindow();
    error HardcapReached();
    error NoEthSent();
    error ZeroTokens();
    error TokenTransferFailed();
    error EthTransferFailed();
    error SoftcapNotReached();
    error ICOnotEnded();
    error SoftcapReachedAlready();
    error NoContribution();
    error RefundFailed();
    error InvalidPrice();
    error ContributionTooLow();
    error ContributionTooHigh();
    error NotEnoughTokens();
    error DirectEthNotAllowed();
    error ICONotActive();
    error NoEthToRelease();
    error NoUnsoldTokens();
    error AlreadyFinalized();
    error NotFinalized();
    error NoEthToWithdraw();
    error UnsoldTokensNotRecovered();

    // --- Constructor ---
    /**
     * @notice Deploys the ICO contract for a specific token and price feed.
     * @param _token The address of the Coatl token contract.
     * @param _priceFeed The address of the Chainlink ETH/USD price feed.
     * @param _softCap The minimum amount of CTL to consider the ICO successful.
     * @param _hardCap The maximum amount of CTL to consider the ICO successful.
     * @param _start The ICO start timestamp.
     * @param _end The ICO end timestamp.
     * @param _projectWallet The immutable project/multisig wallet to receive funds.
     */
    constructor(
        address _token,
        address _priceFeed,
        uint256 _softCap,
        uint256 _hardCap,
        uint256 _start,
        uint256 _end,
        address _projectWallet
    ) Ownable(msg.sender) {
        if (_token == address(0) || _priceFeed == address(0) || _projectWallet == address(0)) revert ZeroAddressNotAllowed();
        if (_softCap == 0 || _hardCap <= _softCap) revert InvalidCaps();
        if (_start >= _end || _end <= block.timestamp) revert InvalidTimeWindow();

        token = IERC20(_token);
        priceFeed = IPriceFeed(_priceFeed);
        softCap = _softCap;
        hardCap = _hardCap;
        start = _start;
        end = _end;
        projectWallet = _projectWallet;

        emit ICOCreated(_start, _end, _softCap, _hardCap);
    }

    // --- Modifiers ---
    modifier onlyWhileOpen() {
        if (block.timestamp < start || block.timestamp > end) {
            if (!icoEndedEventEmitted) {
                icoEndedEventEmitted = true;
                emit ICOEnded(softCapReached, totalRaised);
            }
            revert ICONotActive();
        }
        _;
    }

    // --- Fallbacks ---
    receive() external payable {
        revert DirectEthNotAllowed();
    }

    fallback() external payable {
        revert DirectEthNotAllowed();
    }

    // --- Functions ---

    /**
     * @notice Buy tokens with ETH at the current USD price.
     * @dev Calculates token amount based on Chainlink ETH/USD price and 10 cent USD price per token.
     */
    function buyTokens() external payable nonReentrant onlyWhileOpen {
        if (!started) {
            started = true;
            emit ICOStarted(start, end, softCap, hardCap);
        }

        if (totalTokensSold >= hardCap) revert HardcapReached();
        if (msg.value == 0) revert NoEthSent();

        uint256 ethUsd = getEthUsdPrice();

        uint256 minWei = (MIN_CONTRIBUTION_USD * 1e18) / (ethUsd / 1e16);
        uint256 maxWei = (MAX_CONTRIBUTION_USD * 1e18) / (ethUsd / 1e16);

        if (msg.value < minWei) revert ContributionTooLow();
        if (contributions[msg.sender] + msg.value > maxWei) revert ContributionTooHigh();

        uint256 usdValue = (msg.value * ethUsd) / 1e18;
        uint256 tokens = (usdValue * 100) / TOKEN_USD_PRICE;
        if (tokens == 0) revert ZeroTokens();
        if (token.balanceOf(address(this)) < tokens) revert NotEnoughTokens();

        if (totalTokensSold + tokens > hardCap) revert HardcapReached();

        if (!token.transfer(msg.sender, tokens)) revert TokenTransferFailed();

        contributions[msg.sender] += msg.value;
        tokensPurchased[msg.sender] += tokens;
        totalRaised += msg.value;
        totalTokensSold += tokens;

        emit TokensPurchased(msg.sender, msg.value, tokens);

        if (!softCapReached && totalTokensSold >= softCap) {
            softCapReached = true;
        }
    }

    /**
     * @notice Returns the latest ETH/USD price from Chainlink.
     * @dev Scales the price to 18 decimals.
     */
    function getEthUsdPrice() public view returns (uint256) {
        int256 price = priceFeed.latestAnswer(); // 8 decimals
        if (price <= 0) revert InvalidPrice();
        return uint256(price) * 1e10; // scale to 18 decimals
    }

    /**
     * @notice Returns the minimum amount of wei allowed for a token purchase at the current ETH/USD price.
     */
    function getMinWeiAllowed() external view returns (uint256) {
        uint256 ethUsd = getEthUsdPrice();
        return (MIN_CONTRIBUTION_USD * 1e18) / (ethUsd / 1e16);
    }

    /**
     * @notice Returns the maximum amount of wei allowed for a token purchase at the current ETH/USD price.
     */
    function getMaxWeiAllowed() external view returns (uint256) {
        uint256 ethUsd = getEthUsdPrice();
        return (MAX_CONTRIBUTION_USD * 1e18) / (ethUsd / 1e16);
    }

    /**
     * @notice Releases all raised ETH to the project wallet if softcap is reached.
     */
    function releaseFunds() external onlyOwner nonReentrant {
        if (!softCapReached) revert SoftcapNotReached();
        uint256 amount = address(this).balance;
        if (amount == 0) revert NoEthToRelease();
        (bool sent, ) = projectWallet.call{value: amount}("");
        if (!sent) revert TokenTransferFailed();
        emit FundsReleased(projectWallet, amount);
    }

    /**
     * @notice Allows contributors to claim a refund if the ICO was unsuccessful.
     */
    function claimRefund() external nonReentrant {
        if (block.timestamp <= end) revert ICOnotEnded();
        if (softCapReached) revert SoftcapReachedAlready();
        uint256 contributed = contributions[msg.sender];
        if (contributed == 0) revert NoContribution();
        (bool sent, ) = msg.sender.call{value: contributed}("");
        if (!sent) revert RefundFailed();
        contributions[msg.sender] = 0;
        emit RefundClaimed(msg.sender, contributed);
    }

    /**
     * @notice Returns true if the ICO softcap has been reached.
     */
    function icoSuccessful() public view returns (bool) {
        return softCapReached;
    }

    /**
     * @notice Returns true if the ICO has ended (by time or hardcap).
     */
    function icoEnded() public view returns (bool) {
        return block.timestamp > end || totalTokensSold >= hardCap;
    }

    /**
     * @notice Owner can recover unsold tokens after ICO ends.
     * @param to The address to receive the unsold tokens.
     */
    function recoverUnsoldTokens(address to) external onlyOwner {
        uint256 unsold = token.balanceOf(address(this));
        if (!icoEnded()) revert ICOnotEnded();
        if (finalized) revert AlreadyFinalized();
        if (unsold == 0) revert NoUnsoldTokens();
        if (!token.transfer(to, unsold)) revert TokenTransferFailed();
        emit UnsoldTokensRecovered(to, unsold);
    }

    /**
     * @notice Finalizes the ICO, preventing further state changes.
     * Can only be called after the ICO has ended and all unsold tokens are recovered.
     */
    function finalize() external onlyOwner {
        if (!icoEnded()) revert ICOnotEnded();
        if (finalized) revert AlreadyFinalized();
        if (token.balanceOf(address(this)) > 0) revert UnsoldTokensNotRecovered();
        finalized = true;
        emit Finalized();
    }

    /**
     * @notice Emergency function to withdraw stuck ETH after ICO is finalized.
     * Only callable by the owner and only after finalization.
     * @param to The address to receive the ETH.
     */
    function emergencyWithdraw(address to) external onlyOwner {
        if (!finalized) revert NotFinalized();
        uint256 amount = address(this).balance;
        if (amount == 0) revert NoEthToWithdraw();
        (bool sent, ) = to.call{value: amount}("");
        if (!sent) revert EthTransferFailed();
        emit EmergencyWithdraw(to, amount);
    }
}