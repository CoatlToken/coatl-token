// contracts/Coatl.sol
// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Coatl Token
 * @dev ERC20 token with burn, pause, and fee mechanisms.
 * Includes whitelist and blacklist functionality.
 */
contract Coatl is ERC20, ERC20Burnable, ERC20Pausable, Ownable {
    // White and Blacklist mapping
    mapping(address => uint8) private _listStatus; // 0 = none, 1 = whitelisted, 2 = blacklisted

    // Burn fee exceptions mapping
    mapping(address => bool) private _burnFeeExceptions;

    // Constants for readability
    uint8 private constant NONE = 0;
    uint8 private constant WHITELISTED = 1;
    uint8 private constant BLACKLISTED = 2;

    // Transfer commission (percentage)
    uint256 public transferFee = 1; // 1% commission
    address public feeReceiver; // Address to receive the commission

    // Burn fee (percentage)
    uint256 public burnFee = 1; // 1% burn fee

    // Events
    /**
     * @dev Emitted when an account's whitelist or blacklist status is updated.
     */
    event ListStatusUpdated(address account, bool whitelisted, bool blacklisted);

    /**
     * @dev Emitted when the transfer fee is updated.
     */
    event FeeUpdated(uint256 newFee);

    /**
     * @dev Emitted when the burn fee is updated.
     */
    event BurnFeeUpdated(uint256 newFee);

    /**
     * @dev Emitted when the fee receiver address is updated.
     */
    event FeeReceiverUpdated(address newReceiver);

    /**
     * @notice Constructor to initialize the Coatl token.
     * @param initialSupply The initial supply of tokens to mint.
     */
    constructor(uint256 initialSupply) ERC20("Coatl", "CTL") Ownable(msg.sender) {
        feeReceiver = msg.sender; // Set the contract owner as the default fee receiver
        _mint(msg.sender, initialSupply); // Mint initial supply to the contract owner
    }

    // Whitelist functions

    /**
     * @notice Adds an account to the whitelist.
     * @dev Only callable by the contract owner.
     * @param account The address to be added to the whitelist.
     */
    function addWhitelist(address account) external onlyOwner {
        require(
            _listStatus[account] != BLACKLISTED &&
                _listStatus[account] != WHITELISTED,
            "Coatl: account is either blacklisted or already whitelisted"
        );
        _listStatus[account] = WHITELISTED;
        emit ListStatusUpdated(account, true, false);
    }

    /**
     * @notice Removes an account from the whitelist.
     * @dev Only callable by the contract owner.
     * @param account The address to be removed from the whitelist.
     */
    function removeWhitelist(address account) external onlyOwner {
        require(
            _listStatus[account] == WHITELISTED,
            "Coatl: account is not whitelisted"
        );
        _listStatus[account] = NONE;
        emit ListStatusUpdated(account, false, false);
    }

    /**
     * @notice Checks if an account is whitelisted.
     * @param account The address to check.
     * @return True if the account is whitelisted, false otherwise.
     */
    function isWhitelisted(address account) external view returns (bool) {
        return _listStatus[account] == WHITELISTED;
    }

    // Blacklist functions

    /**
     * @notice Adds an account to the blacklist.
     * @dev Only callable by the contract owner.
     * @param account The address to be added to the blacklist.
     */
    function addBlacklist(address account) external onlyOwner {
        require(
            _listStatus[account] != BLACKLISTED,
            "Coatl: account is already blacklisted"
        );

        // If the account is whitelisted, remove it from the whitelist
        if (_listStatus[account] == WHITELISTED) {
            _listStatus[account] = NONE; // Remove from whitelist
            emit ListStatusUpdated(account, false, false); // Emit event to reflect removal
        }

        _listStatus[account] = BLACKLISTED;
        emit ListStatusUpdated(account, false, true);
    }

    /**
     * @notice Removes an account from the blacklist.
     * @dev Only callable by the contract owner.
     * @param account The address to be removed from the blacklist.
     */
    function removeBlacklist(address account) external onlyOwner {
        require(
            _listStatus[account] == BLACKLISTED,
            "Coatl: account is not blacklisted"
        );
        _listStatus[account] = NONE;
        emit ListStatusUpdated(account, false, false);
    }

    /**
     * @notice Checks if an account is blacklisted.
     * @param account The address to check.
     * @return True if the account is blacklisted, false otherwise.
     */
    function isBlacklisted(address account) external view returns (bool) {
        return _listStatus[account] == BLACKLISTED;
    }

    // Add burn exceptions

    /**
     * @notice Adds an account to the burn fee exception list.
     * @dev Only callable by the contract owner.
     * @param account The address to be added to the exception list.
     */
    function addBurnFeeException(address account) external onlyOwner {
        _burnFeeExceptions[account] = true;
    }

    /**
     * @notice Removes an account from the burn fee exception list.
     * @dev Only callable by the contract owner.
     * @param account The address to be removed from the exception list.
     */
    function removeBurnFeeException(address account) external onlyOwner {
        _burnFeeExceptions[account] = false;
    }

    /**
     * @notice Checks if an account is exempt from the burn fee.
     * @param account The address to check.
     * @return True if the account is exempt, false otherwise.
     */
    function isBurnFeeException(address account) external view returns (bool) {
        return _burnFeeExceptions[account];
    }

    // Transfer commission functions

    /**
     * @notice Updates the transfer fee percentage.
     * @dev Only callable by the contract owner. The fee is capped at 5%.
     * @param newFee The new transfer fee percentage.
     */
    function updateFee(uint256 newFee) external onlyOwner {
        require(
            newFee <= 5,
            "Coatl: fee must be less than or equal to 5"
        );

        if (newFee == transferFee) {
            return;
        }

        transferFee = newFee;
        emit FeeUpdated(newFee);
    }

    // Burn fee functions

    /**
     * @notice Updates the burn fee percentage.
     * @dev Only callable by the contract owner. The fee is capped at 5%.
     * @param newFee The new burn fee percentage.
     */
    function updateBurnFee(uint256 newFee) external onlyOwner {
        require(
            newFee <= 5,
            "Coatl: fee must be less than or equal to 5"
        );

        if (newFee == burnFee) {
            return;
        }

        burnFee = newFee;
        emit BurnFeeUpdated(newFee);
    }

    /**
     * @notice Updates the fee receiver address.
     * @dev Only callable by the contract owner.
     * @param newReceiver The new fee receiver address.
     */
    function updateFeeReceiver(address newReceiver) external onlyOwner {
        require(
            newReceiver != address(0),
            "Coatl: feeReceiver cannot be zero address"
        );
        feeReceiver = newReceiver;
        emit FeeReceiverUpdated(newReceiver);
    }

    // Overrides

    /**
     * @dev Internal function to handle token transfers with fee and blacklist checks.
     * @param sender The address sending the tokens.
     * @param recipient The address receiving the tokens.
     * @param amount The amount of tokens to transfer.
     */
    function _update(
        address sender,
        address recipient,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        require(
            _listStatus[sender] != BLACKLISTED,
            "Coatl: sender is blacklisted"
        );
        require(
            _listStatus[recipient] != BLACKLISTED,
            "Coatl: recipient is blacklisted"
        );

        bool isExemptFromFee = sender == address(0) || // Minting
            sender == feeReceiver ||
            _listStatus[sender] == WHITELISTED ||
            _listStatus[recipient] == WHITELISTED ||
            transferFee == 0;

        if (isExemptFromFee) {
            super._update(sender, recipient, amount);
        } else {
            uint256 feeAmount;
            uint256 transferAmount;

            unchecked {
                feeAmount = (amount * transferFee) / 100;
                transferAmount = amount - feeAmount;
            }

            super._update(sender, recipient, transferAmount);
            super._update(sender, feeReceiver, feeAmount);
        }
    }

    /**
     * @notice Burns a specified amount of tokens.
     * @dev Applies a burn fee unless the sender is exempt.
     * @param amount The amount of tokens to burn.
     */
    function burn(uint256 amount) public override {
        bool isExemptFromBurnFee = _burnFeeExceptions[msg.sender] || msg.sender == owner() || burnFee == 0;

        if (isExemptFromBurnFee) {
            super.burn(amount);
        } else {
            uint256 feeAmount;
            uint256 burnAmount;

            unchecked {
                feeAmount = (amount * burnFee) / 100;
                burnAmount = amount - feeAmount;
            }

            super.burn(burnAmount);
            super._update(msg.sender, feeReceiver, feeAmount);
        }
    }

    /**
     * @notice Pauses all token transfers.
     * @dev Only callable by the contract owner.
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @notice Unpauses all token transfers.
     * @dev Only callable by the contract owner.
     */
    function unpause() public onlyOwner {
        _unpause();
    }
}
