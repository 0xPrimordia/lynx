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
        
        // Create token key arrays - only admin and supply keys
        address[] memory adminKey = new address[](1);
        adminKey[0] = ADMIN;
        
        address[] memory supplyKey = new address[](1);
        supplyKey[0] = address(this);
        
        address[] memory emptyKeys = new address[](0);
        
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
            decimals: TOKEN_DECIMALS
        });
        
        // Create key types and addresses arrays
        uint8[] memory keys = new uint8[](2);
        keys[0] = 1; // Admin key
        keys[1] = 4; // Supply key
        
        address[] memory keyAddresses = new address[](2);
        keyAddresses[0] = ADMIN;
        keyAddresses[1] = address(this);
        
        // Create token with value for fees
        (int64 responseCode, address tokenAddress) = hts.createToken{value: msg.value}(
            token,
            0, // Initial supply is 0
            keys,
            keyAddresses
        );
        
        // Check response
        if (responseCode != 0) {
            revert TokenCreationFailed(responseCode);
        }
        
        // Store token address
        INDEX_TOKEN = tokenAddress;
        
        // Associate with token
        int64 associateResponse = hts.associateToken(address(this), tokenAddress);
        if (associateResponse != 0) {
            revert TokenCreationFailed(associateResponse);
        }
        
        // Inform the vault about the token
        vault.setIndexToken(tokenAddress);
        
        // Verify supply key
        checkSupplyKey();
        
        emit IndexTokenCreated(tokenAddress, responseCode);
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
    function mintTo(address recipient, uint256 amount) external onlyAdmin supplyKeyRequired {
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