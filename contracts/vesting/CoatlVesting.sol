// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Coatl Vesting Contract
 * @notice Holds and releases Coatl tokens for founders and contributors according to vesting schedules.
 * @dev Supports linear monthly vesting for founders (1 year) and custom vesting for contributors.
 * @custom:security-contact security@coatl.one
 */
contract CoatlVesting is Ownable, ReentrancyGuard {
    /// @notice Vesting schedule for a beneficiary
    struct VestingSchedule {
        uint256 totalAmount; ///< Total tokens to vest
        uint256 released;    ///< Amount already released
        uint256 start;       ///< Vesting start timestamp
        uint256 cliff;       ///< Cliff timestamp
        uint256 end;         ///< Vesting end timestamp
        bool isFounder;      ///< True if founder vesting
    }

    /// @notice The Coatl token contract
    IERC20 public immutable token;

    /// @notice Mapping of beneficiary address to their vesting schedule
    mapping(address => VestingSchedule) public vestings;

    /// @notice List of all addresses with a vesting schedule
    address[] private vestedAccounts;

    /// @notice Emitted when a vesting schedule is added
    event VestingAdded(address indexed beneficiary, uint256 totalAmount, uint256 start, uint256 end, bool isFounder);

    /// @notice Emitted when tokens are released to a beneficiary
    event TokensReleased(address indexed beneficiary, uint256 amount);

    /// @notice Emitted when a vesting schedule is revoked
    event VestingRevoked(address indexed beneficiary);

    /// @notice Emitted when unused tokens are recovered by the owner
    event UnusedTokensRecovered(address indexed to, uint256 amount);

    // Custom Errors
    error ZeroAddressNotAllowed();
    error AlreadyVested(address beneficiary);
    error AmountZero();
    error StartDateInPast();
    error EndBeforeStart();
    error InsufficientTokensForVesting();
    error NoVesting(address beneficiary);
    error NothingToRelease();
    error CannotWithdrawVestedTokens();
    error TokenTransferFailed();

    /**
     * @notice Deploys the vesting contract for a specific token.
     * @param tokenAddress The address of the Coatl token contract.
     */
    constructor(address tokenAddress) Ownable(msg.sender) {
        if (tokenAddress == address(0)) revert ZeroAddressNotAllowed();
        token = IERC20(tokenAddress);
    }

    /**
     * @notice Adds a founder vesting schedule (1 year, linear monthly).
     * @param beneficiary The address to vest tokens for.
     * @param totalAmount The total amount of tokens to vest.
     * @param start The vesting start timestamp (must be >= now).
     * @param cliff The cliff timestamp (must be >= start).
     */
    function addFounder(address beneficiary, uint256 totalAmount, uint256 start, uint256 cliff) external onlyOwner {
        if (beneficiary == address(0)) revert ZeroAddressNotAllowed();
        if (vestings[beneficiary].totalAmount != 0) revert AlreadyVested(beneficiary);
        if (totalAmount == 0) revert AmountZero();
        if (start < block.timestamp) revert StartDateInPast();
        if (cliff < start) revert EndBeforeStart();
        uint256 end = start + 365 days;
        uint256 required = totalUnclaimedObligation() + totalAmount;
        if (token.balanceOf(address(this)) < required) revert InsufficientTokensForVesting();
        vestings[beneficiary] = VestingSchedule(totalAmount, 0, start, cliff, end, true);
        vestedAccounts.push(beneficiary);
        emit VestingAdded(beneficiary, totalAmount, start, end, true);
    }

    /**
     * @notice Adds a contributor vesting schedule (custom period, linear monthly).
     * @param beneficiary The address to vest tokens for.
     * @param totalAmount The total amount of tokens to vest.
     * @param start The vesting start timestamp (must be >= now).
     * @param cliff The cliff timestamp (must be >= start).
     * @param end The vesting end timestamp (must be after start).
     */
    function addContributor(
        address beneficiary,
        uint256 totalAmount,
        uint256 start,
        uint256 cliff,
        uint256 end
    ) external onlyOwner {
        if (beneficiary == address(0)) revert ZeroAddressNotAllowed();
        if (vestings[beneficiary].totalAmount > 0) revert AlreadyVested(beneficiary);
        if (totalAmount == 0) revert AmountZero();
        if (start < block.timestamp) revert StartDateInPast();
        if (cliff < start) revert EndBeforeStart();
        if (end <= start) revert EndBeforeStart();
        uint256 required = totalUnclaimedObligation() + totalAmount;
        if (token.balanceOf(address(this)) < required) revert InsufficientTokensForVesting();
        vestings[beneficiary] = VestingSchedule(totalAmount, 0, start, cliff, end, false);
        vestedAccounts.push(beneficiary);
        emit VestingAdded(beneficiary, totalAmount, start, end, false);
    }

    /**
     * @notice Returns the amount of tokens that can be released for a beneficiary.
     * @param beneficiary The address to check.
     * @return The amount of tokens currently releasable.
     */
    function releasableAmount(address beneficiary) public view returns (uint256) {
        VestingSchedule memory vest = vestings[beneficiary];
        if (block.timestamp < vest.cliff) return 0; // Cliff not reached
        if (block.timestamp < vest.start) return 0;
        if (block.timestamp >= vest.end) return vest.totalAmount - vest.released;
        uint256 monthsElapsed = (block.timestamp - vest.start) / 30 days;
        uint256 totalMonths = (vest.end - vest.start) / 30 days;
        if (totalMonths == 0) totalMonths = 1;
        uint256 vested = (vest.totalAmount * monthsElapsed) / totalMonths;
        if (vested > vest.totalAmount) vested = vest.totalAmount;
        return vested - vest.released;
    }

    /**
     * @notice Releases vested tokens to the caller.
     */
    function release() external nonReentrant {
        uint256 amount = releasableAmount(msg.sender);
        if (amount == 0) revert NothingToRelease();
        vestings[msg.sender].released += amount;
        if (!token.transfer(msg.sender, amount)) revert TokenTransferFailed();
        emit TokensReleased(msg.sender, amount);
    }

    /**
     * @notice Revokes a vesting schedule, preventing further releases.
     * @param beneficiary The address whose vesting is revoked.
     */
    function revokeVesting(address beneficiary) external onlyOwner {
        VestingSchedule storage vest = vestings[beneficiary];
        if (vest.totalAmount == 0) revert NoVesting(beneficiary);
        vest.totalAmount = vest.released;
        emit VestingRevoked(beneficiary);
    }

    /**
     * @notice Returns the contract's current token balance.
     * @return The token balance of this contract.
     */
    function contractTokenBalance() external view returns (uint256) {
        return token.balanceOf(address(this));
    }

    /**
     * @notice Returns the total unclaimed vesting obligations (tokens still owed).
     * @return The total amount of tokens owed to all beneficiaries.
     */
    function totalUnclaimedObligation() public view returns (uint256) {
        uint256 totalObligation = 0;
        for (uint256 i = 0; i < vestedAccounts.length; i++) {
            VestingSchedule memory vest = vestings[vestedAccounts[i]];
            totalObligation += (vest.totalAmount - vest.released);
        }
        return totalObligation;
    }

    /**
     * @notice Returns the list of all addresses with a vesting schedule.
     * @return Array of beneficiary addresses.
     */
    function getVestedAccounts() external view returns (address[] memory) {
        return vestedAccounts;
    }

    /**
     * @notice Allows the owner to recover tokens not reserved for vesting obligations.
     * @param to The address to send the recovered tokens to.
     * @param amount The amount of tokens to recover.
     */
    function recoverUnusedTokens(address to, uint256 amount) external onlyOwner {
        uint256 totalObligation = 0;
        for (uint256 i = 0; i < vestedAccounts.length; i++) {
            VestingSchedule memory vest = vestings[vestedAccounts[i]];
            totalObligation += (vest.totalAmount - vest.released);
        }
        uint256 available = token.balanceOf(address(this)) - totalObligation;
        if (amount > available) revert CannotWithdrawVestedTokens();
        if (!token.transfer(to, amount)) revert TokenTransferFailed();
        emit UnusedTokensRecovered(to, amount);
    }
}