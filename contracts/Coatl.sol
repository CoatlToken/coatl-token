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
 * @custom:security-contact security@coatlproject.com
 */
contract Coatl is ERC20, ERC20Burnable, ERC20Pausable, Ownable {
    // Custom Errors
    error AccountBlacklisted(address account);
    error AccountAlreadyWhitelisted(address account);
    error AccountNotWhitelisted(address account);
    error AccountAlreadyBlacklisted(address account);
    error AccountNotBlacklisted(address account);
    error FeeTooHigh(uint256 fee);
    error ZeroAddressNotAllowed();
    error SenderBlacklisted(address sender);
    error RecipientBlacklisted(address recipient);
    error UnauthorizedCaller();
    error BurnFeeTooHigh(uint256 fee);

    // White and Blacklist mapping
    mapping(address account => uint8 status) private _listStatus; // 0 = none, 1 = whitelisted, 2 = blacklisted

    // Burn fee exceptions mapping
    mapping(address account => bool isExempt) private _burnFeeExceptions;

    // MultiSig wallet address
    address public multiSigWallet;

    // Constants for readability
    uint8 private constant WHITELISTED = 1;
    uint8 private constant BLACKLISTED = 2;

    // Transfer commission (percentage)
    /**
     * @notice The percentage fee applied to token transfers.
     * @dev The fee is deducted from the transfer amount and sent to the fee receiver.
     * @return The current transfer fee percentage (e.g., 1 for 1%).
     */
    uint256 public transferFee = 1; // 1% commission

    // Address to receive the commission
    /**
     * @notice The address that receives the transfer fee.
     * @dev By default, this is set to the multi-signature wallet address.
     * @return The current fee receiver address.
     */
    address public feeReceiver; // Address to receive the commission

    // Burn fee (percentage)
    /**
     * @notice The percentage fee applied when tokens are burned.
     * @dev The fee is deducted from the burn amount and sent to the fee receiver.
     * @return The current burn fee percentage (e.g., 1 for 1%).
     */
    uint256 public burnFee = 1; // 1% burn fee

    // Events
    /**
     * @dev Emitted when an account's whitelist or blacklist status is updated.
     */
    event ListStatusUpdated(
        address indexed account, // Indexed for filtering by account
        bool whitelisted,
        bool blacklisted
    );

    /**
     * @dev Emitted when the transfer fee is updated.
     */
    event FeeUpdated(uint256 indexed newFee); // Indexed for filtering by fee

    /**
     * @dev Emitted when the burn fee is updated.
     */
    event BurnFeeUpdated(uint256 indexed newFee); // Indexed for filtering by burn fee

    /**
     * @dev Emitted when the fee receiver address is updated.
     */
    event FeeReceiverUpdated(address indexed newReceiver); // Indexed for filtering by receiver

    /**
     * @dev Emitted when the contract is initialized.
     */
    event ContractInitialized(address indexed owner, uint256 initialSupply);

    /**
     * @dev Emitted when an account is added to the burn fee exception list.
     */
    event BurnFeeExceptionUpdated(address indexed account, bool isExempt);

    /**
     * @dev Emitted when a transfer occurs with fees.
     */
    event TransferWithFee(address indexed sender, address indexed recipient, uint256 amount, uint256 fee);

    /**
     * @dev Emitted when tokens are burned with fees.
     */
    event BurnWithFee(address indexed sender, uint256 burnAmount, uint256 feeAmount);

    /**
     * @dev Emitted when the MultiSig wallet address is updated.
     */
    event MultiSigWalletUpdated(address indexed newWallet);

    /**
     * @notice Constructor to initialize the Coatl token.
     * @param initialSupply The initial supply of tokens to mint.
     * @param _multiSigWallet The address of the MultiSig wallet.
     */
    constructor(uint256 initialSupply, address _multiSigWallet) ERC20("Coatl", "CTL") Ownable(msg.sender) {
        require(_multiSigWallet != address(0), "Invalid MultiSig wallet address");
        multiSigWallet = _multiSigWallet;
        feeReceiver = multiSigWallet; // Set the multi-signature wallet as the default fee receiver
        _mint(multiSigWallet, initialSupply); // Mint initial supply to the multi-signature wallet
        emit ContractInitialized(multiSigWallet, initialSupply); // Emit event
    }

    /**
     * @notice Updates the MultiSig wallet address.
     * @dev Only callable by the current MultiSig wallet.
     * @param newWallet The new MultiSig wallet address.
     * @custom:throws UnauthorizedCaller If the caller is not the current MultiSig wallet.
     * @custom:throws ZeroAddressNotAllowed If the new wallet address is the zero address.
     */
    function updateMultiSigWallet(address newWallet) external onlyMultiSig {
        require(newWallet != address(0), "Invalid MultiSig wallet address");
        multiSigWallet = newWallet;
        emit MultiSigWalletUpdated(newWallet);
    }

    /**
     * @dev Modifier to restrict access to the MultiSig wallet.
     */
    modifier onlyMultiSig() {
        if (msg.sender != multiSigWallet) revert UnauthorizedCaller();
        _;
    }

    // Whitelist functions

    /**
     * @notice Adds an account to the whitelist.
     * @dev Only callable by the MultiSig wallet.
     * @param account The address to be added to the whitelist.
     */
    function addWhitelist(address account) external onlyMultiSig {
        if (_listStatus[account] == BLACKLISTED)
            revert AccountBlacklisted(account);
        if (_listStatus[account] == WHITELISTED)
            revert AccountAlreadyWhitelisted(account);

        _listStatus[account] = WHITELISTED;
        emit ListStatusUpdated(account, true, false); // Emit event
    }

    /**
     * @notice Removes an account from the whitelist.
     * @dev Only callable by the MultiSig wallet.
     * @param account The address to be removed from the whitelist.
     */
    function removeWhitelist(address account) external onlyMultiSig {
        if (_listStatus[account] != WHITELISTED)
            revert AccountNotWhitelisted(account);

        _listStatus[account] = 0;
        emit ListStatusUpdated(account, false, false); // Emit event
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
     * @dev Only callable by the MultiSig wallet.
     * @param account The address to be added to the blacklist.
     */
    function addBlacklist(address account) external onlyMultiSig {
        if (_listStatus[account] == BLACKLISTED)
            revert AccountAlreadyBlacklisted(account);

        // If the account is whitelisted, remove it from the whitelist
        if (_listStatus[account] == WHITELISTED) {
            _listStatus[account] = 0; // Remove from whitelist
            emit ListStatusUpdated(account, false, false); // Emit event
        }

        _listStatus[account] = BLACKLISTED;
        emit ListStatusUpdated(account, false, true); // Emit event
    }

    /**
     * @notice Removes an account from the blacklist.
     * @dev Only callable by the MultiSig wallet.
     * @param account The address to be removed from the blacklist.
     */
    function removeBlacklist(address account) external onlyMultiSig {
        if (_listStatus[account] != BLACKLISTED)
            revert AccountNotBlacklisted(account);

        _listStatus[account] = 0;
        emit ListStatusUpdated(account, false, false); // Emit event
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
        emit BurnFeeExceptionUpdated(account, true); // Emit event
    }

    /**
     * @notice Removes an account from the burn fee exception list.
     * @dev Only callable by the contract owner.
     * @param account The address to be removed from the exception list.
     */
    function removeBurnFeeException(address account) external onlyOwner {
        _burnFeeExceptions[account] = false;
        emit BurnFeeExceptionUpdated(account, false); // Emit event
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
     * @custom:throws FeeTooHigh If the new fee exceeds 5%.
     */
    function updateFee(uint256 newFee) external onlyOwner {
        if (newFee > 5) revert FeeTooHigh(newFee);

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
     * @custom:throws BurnFeeTooHigh If the new fee exceeds 5%.
     */
    function updateBurnFee(uint256 newFee) external onlyOwner {
        if (newFee > 5) revert BurnFeeTooHigh(newFee);

        if (newFee == burnFee) {
            return;
        }

        burnFee = newFee;
        emit BurnFeeUpdated(newFee);
    }

    /**
     * @notice Updates the fee receiver address.
     * @dev Only callable by the MultiSig wallet.
     * @param newReceiver The new fee receiver address.
     * @custom:throws ZeroAddressNotAllowed If the new receiver address is the zero address.
     */
    function updateFeeReceiver(address newReceiver) external onlyMultiSig {
        if (newReceiver == address(0)) revert ZeroAddressNotAllowed();

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
        if (_listStatus[sender] == BLACKLISTED)
            revert SenderBlacklisted(sender);
        if (_listStatus[recipient] == BLACKLISTED)
            revert RecipientBlacklisted(recipient);

        bool isExemptFromFee = sender == address(0) || // Minting
            sender == feeReceiver ||
            _listStatus[sender] == WHITELISTED ||
            _listStatus[recipient] == WHITELISTED ||
            transferFee == 0;

        if (isExemptFromFee) {
            super._update(sender, recipient, amount);
        } else {
            uint256 feeAmount = (amount * transferFee) / 100;
            uint256 transferAmount = amount - feeAmount;

            super._update(sender, recipient, transferAmount);
            super._update(sender, feeReceiver, feeAmount);
            emit TransferWithFee(sender, recipient, transferAmount, feeAmount); // Emit event
        }
    }

    /**
     * @notice Burns a specified amount of tokens.
     * @dev Applies a burn fee unless the sender is exempt.
     * @param amount The amount of tokens to burn.
     * @custom:throws SenderBlacklisted If the sender is blacklisted.
     */
    function burn(uint256 amount) public override {
        address sender = _msgSender(); // Use _msgSender() for consistency

        bool isExemptFromBurnFee = _burnFeeExceptions[sender] ||
            sender == owner() ||
            burnFee == 0;

        if (isExemptFromBurnFee) {
            super.burn(amount);
        } else {
            uint256 feeAmount = (amount * burnFee) / 100;
            uint256 burnAmount = amount - feeAmount;

            super.burn(burnAmount);
            super._update(sender, feeReceiver, feeAmount);
            emit BurnWithFee(sender, burnAmount, feeAmount); // Emit event
        }
    }

    /**
     * @notice Pauses all token transfers.
     * @dev Only callable by the MultiSig wallet.
     */
    function pause() public onlyMultiSig {
        _pause();
    }

    /**
     * @notice Unpauses all token transfers.
     * @dev Only callable by the MultiSig wallet.
     */
    function unpause() public onlyMultiSig {
        _unpause();
    }
}
