// contracts/Coatl.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {ERC20Pausable} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract Coatl is ERC20, ERC20Burnable, ERC20Pausable, Ownable {
    // White and Blacklist mapping
    mapping(address => uint8) private _listStatus; // 0 = none, 1 = whitelisted, 2 = blacklisted

    // burn fee exceptions mapping
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
    event ListStatusUpdated(
        address account,
        bool whitelisted,
        bool blacklisted
    );
    event FeeUpdated(uint256 newFee);
    event BurnFeeUpdated(uint256 newFee);
    event FeeReceiverUpdated(address newReceiver);

    constructor(
        uint256 initialSupply
    ) ERC20("Coatl", "CTL") Ownable(msg.sender) {
        feeReceiver = msg.sender; // Set the contract owner as the default fee receiver
        _mint(msg.sender, initialSupply); // Mint initial supply to the contract owner
    }

    // Whitelist functions
    function addWhitelist(address account) external onlyOwner {
        require(
            _listStatus[account] != BLACKLISTED &&
                _listStatus[account] != WHITELISTED,
            "Coatl: account is either blacklisted or already whitelisted"
        );
        _listStatus[account] = WHITELISTED;
        emit ListStatusUpdated(account, true, false);
    }

    function removeWhitelist(address account) external onlyOwner {
        require(
            _listStatus[account] == WHITELISTED,
            "Coatl: account is not whitelisted"
        );
        _listStatus[account] = NONE;
        emit ListStatusUpdated(account, false, false);
    }

    function isWhitelisted(address account) external view returns (bool) {
        return _listStatus[account] == WHITELISTED;
    }

    // Blacklist functions
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

    function removeBlacklist(address account) external onlyOwner {
        require(
            _listStatus[account] == BLACKLISTED,
            "Coatl: account is not blacklisted"
        );
        _listStatus[account] = NONE;
        emit ListStatusUpdated(account, false, false);
    }

    function isBlacklisted(address account) external view returns (bool) {
        return _listStatus[account] == BLACKLISTED;
    }

    // add burn exceptions
    function addBurnFeeException(address account) external onlyOwner {
        _burnFeeExceptions[account] = true;
    }

    function removeBurnFeeException(address account) external onlyOwner {
        _burnFeeExceptions[account] = false;
    }

    function isBurnFeeException(address account) external view returns (bool) {
        return _burnFeeExceptions[account];
    }

    // Transfer commission functions
    function updateFee(uint256 newFee) external onlyOwner {

        // limit the fee to 5% max
        require(
            newFee <= 5,
            "Coatl: fee must be less than or equal to 5"
        );

        // Guard clause: Check if the fee is actually different before making the update
        if (newFee == transferFee) {
            return; // No change needed, so skip the rest of the logic and return early
        }        

        // Update the transfer fee and emit an event
        transferFee = newFee;
        emit FeeUpdated(newFee);
    }

    // burn fee functions
    function updateBurnFee(uint256 newFee) external onlyOwner {

        // limit the burn fee to 5% max
        require(
            newFee <= 5,
            "Coatl: fee must be less than or equal to 5"
        );

        // Guard clause: Check if the fee is actually different before making the update
        if (newFee == burnFee) {
            return; // No change needed, so skip the rest of the logic and return early
        }

        // Update the burn fee and emit an event
        burnFee = newFee;
        emit BurnFeeUpdated(newFee);
    }

    function updateFeeReceiver(address newReceiver) external onlyOwner {
        require(
            newReceiver != address(0),
            "Coatl: feeReceiver cannot be zero address"
        );
        feeReceiver = newReceiver;
        emit FeeReceiverUpdated(newReceiver);
    }

    // Overrides
    function _update(
        address sender,
        address recipient,
        uint256 amount
    ) internal override(ERC20, ERC20Pausable) {
        // Check blacklists
        require(
            _listStatus[sender] != BLACKLISTED,
            "Coatl: sender is blacklisted"
        );
        require(
            _listStatus[recipient] != BLACKLISTED,
            "Coatl: recipient is blacklisted"
        );

        // Determine if transfer is exempt from fees
        bool isExemptFromFee = sender == address(0) || // Minting
            sender == feeReceiver ||
            _listStatus[sender] == WHITELISTED ||
            _listStatus[recipient] == WHITELISTED ||
            transferFee == 0;

        // Handle fee exemption or standard transfer logic
        if (isExemptFromFee) {
            // Direct transfer without fee
            super._update(sender, recipient, amount);
        } else {
            // Calculate fee and transfer amounts
            uint256 feeAmount;
            uint256 transferAmount;

            unchecked {
                feeAmount = (amount * transferFee) / 100;
                transferAmount = amount - feeAmount;
            }

            // Transfer with fee deduction
            super._update(sender, recipient, transferAmount);
            super._update(sender, feeReceiver, feeAmount);
        }
    }

    function burn(uint256 amount) public override {
        // determine if the sender is exempt from burn fee or is owner
        bool isExemptFromBurnFee = _burnFeeExceptions[msg.sender] || msg.sender == owner() || burnFee == 0;

        // Handle fee exemption or standard burn logic
        if (isExemptFromBurnFee) {
            super.burn(amount);
        } else {
            uint256 feeAmount;
            uint256 burnAmount;

            unchecked {
                feeAmount = (amount * burnFee) / 100;
                burnAmount = amount - feeAmount;
            }

            // Burn with fee deduction
            super.burn(burnAmount);

            // Transfer fee to feeReceiver
            super._update(msg.sender, feeReceiver, feeAmount);
        }
    }

    function pause() public onlyOwner {
        _pause();
    }

    function unpause() public onlyOwner {
        _unpause();
    }
}
