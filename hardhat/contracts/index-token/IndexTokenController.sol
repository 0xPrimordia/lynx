// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IHederaTokenService.sol";
import {IndexVault} from "./IndexVault.sol";

/**
 * @title IndexTokenController
 * @dev Controller for the index token, handling token creation and minting operations
 */
contract IndexTokenController {
    // Constants
    address public constant HTS_PRECOMPILE = 0x0000000000000000000000000000000000000167;
    
    // Token addresses
    address public INDEX_TOKEN;
    
    // Contract references
    address public ADMIN;
    IndexVault public vault;
    
    // Token configuration
    uint8 public constant TOKEN_DECIMALS = 8;
    uint32 public constant TOKEN_MAX_SUPPLY = 0; // 0 means no maximum supply
    bool public constant IS_SUPPLY_TYPE_INFINITE = true;
    uint32 public constant AUTO_RENEW_PERIOD = 7000000; // ~90 days in seconds
    
    // State variables
    bool public hasSupplyKey = false;

    // Events
    event IndexTokenMinted(address indexed user, uint256 amount);
    event IndexTokenCreated(address tokenAddress, int64 responseCode);
    event SupplyKeyVerified(bool hasKey);
    event IndexTokenSet(address indexed tokenAddress);
    event TokenCreationAttempt(string name, string symbol, string memo, address treasury);
    event TokenCreationError(int64 responseCode, string errorMessage);
    event TokenCreationStep(string step, address tokenAddress, int64 responseCode);

    // Errors
    error OnlyAdmin();
    error InvalidAmount();
    error TokenCreationFailed(int64 errorCode);
    error NoSupplyKeyForToken();
    error TokenNotAssociated(address token, address account);
    error TokenMintFailed(address token, int64 errorCode);
    error TokenTransferFailed(address token, int64 errorCode);
    error InsufficientDeposits();
    error HtsError(address token, int64 responseCode, string message);
    error PreTokenCreationError(string message);

    // For testing purposes
    IHederaTokenService private hts;

    modifier onlyAdmin() {
        if (msg.sender != ADMIN) {
            revert OnlyAdmin();
        }
        _;
    }

    modifier supplyKeyRequired() {
        if (!hasSupplyKey) {
            revert NoSupplyKeyForToken();
        }
        _;
    }

    /**
     * @dev Constructor to initialize the controller
     * @param _vaultAddress Address of the IndexVault that serves as the token treasury
     * @param _htsAddress Address of the HTS precompile (or mock for testing)
     */
    constructor(
        address _vaultAddress,
        address _htsAddress
    ) {
        hts = IHederaTokenService(_htsAddress == address(0) ? HTS_PRECOMPILE : _htsAddress);
        vault = IndexVault(payable(_vaultAddress));
        ADMIN = msg.sender;
        INDEX_TOKEN = address(0);
    }

    /**
     * @dev Used for testing only - allows setting a mock HTS
     * @param mockHts Address of the mock HTS implementation
     */
    function setTokenService(address mockHts) external onlyAdmin {
        hts = IHederaTokenService(mockHts);
    }
    
    /**
     * @dev Create the index token with the controller as supply key holder and vault as treasury
     * @param name The name of the token
     * @param symbol The symbol of the token
     * @param memo Additional information about the token
     */
    function createIndexToken(
        string calldata name, 
        string calldata symbol, 
        string calldata memo
    ) external payable onlyAdmin {
        require(INDEX_TOKEN == address(0), "Index token already exists");
        
        // Log token creation attempt
        emit TokenCreationAttempt(name, symbol, memo, address(this));
        
        // Create token key arrays - only admin and supply keys
        address[] memory adminKey = new address[](1);
        adminKey[0] = ADMIN;
        
        address[] memory supplyKey = new address[](1);
        supplyKey[0] = address(this);
        
        address[] memory emptyKeys = new address[](0);
        
        // Debugging events added to trace execution flow
        emit TokenCreationStep("Before creating token struct", address(0), 0);
        // Create token structure
        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken({
            name: name,
            symbol: symbol,
            treasury: address(vault),
            memo: memo,
            supplyType: IS_SUPPLY_TYPE_INFINITE,
            maxSupply: TOKEN_MAX_SUPPLY,
            freezeDefault: false,
            freezeKey: emptyKeys,
            wipeKey: emptyKeys,
            supplyKey: supplyKey,
            adminKey: adminKey,
            kycKey: emptyKeys,
            decimals: TOKEN_DECIMALS,
            autoRenewAccount: address(this),
            autoRenewPeriod: AUTO_RENEW_PERIOD
        });
        emit TokenCreationStep("After creating token struct", address(0), 0);
        
        // Create key types and addresses arrays
        uint8[] memory keys = new uint8[](3);
        keys[0] = 1; // Admin key
        keys[1] = 4; // Supply key
        keys[2] = 8; // Auto-renew key
        
        address[] memory keyAddresses = new address[](3);
        keyAddresses[0] = ADMIN;
        keyAddresses[1] = address(this);
        keyAddresses[2] = address(this);
        
        // Add more detailed error handling
        emit TokenCreationStep("Debug: About to call createToken", address(0), 0);
        
        // Debugging events added to trace execution flow
        emit TokenCreationStep("Before calling createToken", address(0), 0);
        // Create token with value for fees
        emit TokenCreationStep("Creating token", address(0), 0);
        int64 responseCode;
        address tokenAddress;
        try hts.createToken{value: msg.value}(token, 0, keys, keyAddresses) returns (int64 code, address addr) {
            responseCode = code;
            tokenAddress = addr;
            emit TokenCreationStep("CreateToken call completed", addr, code);
        } catch (bytes memory errorData) {
            string memory errorMessage = string(errorData);
            if (errorData.length == 0) {
                errorMessage = "Unknown error (empty revert data)";
            }
            emit TokenCreationError(-999, errorMessage);
            revert PreTokenCreationError(errorMessage);
        }
        emit TokenCreationStep("After calling createToken", tokenAddress, responseCode);
        
        // Check response
        if (responseCode != 0) {
            string memory errorMessage = responseCode == 22 ? "TOKEN_ALREADY_EXISTS_WITH_DIFFERENT_PROPERTIES" :
                                      responseCode == 27 ? "INVALID_TOKEN_TREASURY_ACCOUNT" :
                                      responseCode == 7 ? "INSUFFICIENT_PAYER_BALANCE" :
                                      "Unknown HTS error";
            emit TokenCreationError(responseCode, errorMessage);
            revert TokenCreationFailed(responseCode);
        }

        // Validate token address
        if (tokenAddress == address(0)) {
            emit TokenCreationError(0, "Token creation succeeded but no token address returned");
            revert TokenCreationFailed(0);
        }
        
        // Store token address
        INDEX_TOKEN = tokenAddress;
        emit TokenCreationStep("Token address stored", tokenAddress, 0);
        
        // Debugging events added to trace execution flow
        emit TokenCreationStep("Before associating token", tokenAddress, 0);
        // Associate with token
        emit TokenCreationStep("Associating with token", tokenAddress, 0);
        int64 associateResponse = hts.associateToken(address(this), tokenAddress);
        if (associateResponse != 0) {
            emit TokenCreationError(associateResponse, "Failed to associate with token");
            revert TokenCreationFailed(associateResponse);
        }
        emit TokenCreationStep("After associating token", tokenAddress, associateResponse);
        emit TokenCreationStep("Token association complete", tokenAddress, 0);
        
        // Debugging events added to trace execution flow
        emit TokenCreationStep("Before updating vault", tokenAddress, 0);
        // Inform the vault about the token
        emit TokenCreationStep("Updating vault", tokenAddress, 0);
        vault.setIndexToken(tokenAddress);
        emit TokenCreationStep("After updating vault", tokenAddress, 0);
        
        // Debugging events added to trace execution flow
        emit TokenCreationStep("Before verifying supply key", tokenAddress, 0);
        // Verify supply key
        emit TokenCreationStep("Verifying supply key", tokenAddress, 0);
        checkSupplyKey();
        emit TokenCreationStep("After verifying supply key", tokenAddress, 0);
        
        emit IndexTokenCreated(tokenAddress, responseCode);
        emit TokenCreationStep("Token creation complete", tokenAddress, 0);
    }
    
    /**
     * @dev Update the index token ID after deployment
     * @param newIndexTokenAddress The new token address
     */
    function setIndexTokenId(address newIndexTokenAddress) external onlyAdmin {
        require(INDEX_TOKEN == address(0), "Index token already set");
        require(newIndexTokenAddress != address(0), "Cannot set to zero address");
        
        INDEX_TOKEN = newIndexTokenAddress;
        
        // Update supply key status
        checkSupplyKey();
        
        // Inform the vault about the token
        vault.setIndexToken(newIndexTokenAddress);
        
        emit IndexTokenSet(newIndexTokenAddress);
    }
    
    /**
     * @dev Verify that this contract has the supply key for the index token
     */
    function checkSupplyKey() public {
        if (INDEX_TOKEN == address(0)) {
            hasSupplyKey = false;
            emit SupplyKeyVerified(false);
            return;
        }
        
        // Check if this contract has the supply key
        hasSupplyKey = hts.isSupplyKey(INDEX_TOKEN, address(this));
        emit SupplyKeyVerified(hasSupplyKey);
    }
    
    /**
     * @dev Force update the hasSupplyKey status
     */
    function updateSupplyKeyStatus() external onlyAdmin {
        checkSupplyKey();
    }
    
    /**
     * @dev Force set the supply key status for testing purposes
     * @param status The new supply key status
     */
    function setSupplyKeyStatus(bool status) external onlyAdmin {
        hasSupplyKey = status;
        emit SupplyKeyVerified(status);
    }

    /**
     * @dev Mint index tokens for a user
     * @param recipient The address to receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mintTo(address recipient, uint256 amount) external supplyKeyRequired {
        // Validation: ensure amount is greater than zero
        if (amount == 0) {
            revert InvalidAmount();
        }

        // Verify the recipient has associated the token
        if (!hts.isTokenAssociated(INDEX_TOKEN, recipient)) {
            revert TokenNotAssociated(INDEX_TOKEN, recipient);
        }
        
        // Validate vault deposits
        bool hasDeposits = vault.validateMint(recipient, amount);
        if (!hasDeposits) {
            revert InsufficientDeposits();
        }

        // Mint tokens to the vault (treasury)
        bytes[] memory metadata = new bytes[](0);
        int64 mintResult = hts.mintToken(INDEX_TOKEN, amount, metadata);
        if (mintResult != 0) {
            string memory message = mintResult == -1 ? "Token not associated" :
                                  mintResult == -2 ? "No supply key" :
                                  mintResult == -3 ? "Invalid amount" :
                                  "Unknown error";
            revert HtsError(INDEX_TOKEN, mintResult, message);
        }
        
        // Send tokens to the recipient through the vault
        vault.receiveMint(recipient, amount);

        // Emit event for successful mint
        emit IndexTokenMinted(recipient, amount);
    }
    
    /**
     * @dev Calculate required deposits for minting a specific amount of index tokens
     * @param amount The amount of index tokens to mint
     * @return Tokens and amounts required for the mint
     */
    function calculateRequiredDeposits(uint256 amount) external view returns (address[] memory, uint256[] memory) {
        return vault.calculateRequiredDeposits(amount);
    }
    
    /**
     * @dev Get token addresses
     * @return The index token address
     */
    function getTokenAddress() public view returns (address) {
        return INDEX_TOKEN;
    }
    
    // Allow contract to receive HBAR
    receive() external payable {}
}