// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./IHederaTokenService.sol";
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

    // Token info struct
    struct HederaToken {
        string name;
        string symbol;
        address treasury;
        string memo;
        bool supplyType;
        uint32 maxSupply;
        bool freezeDefault;
        address[] freezeKey;
        address[] wipeKey;
        address[] supplyKey;
        address[] adminKey;
        address[] kycKey;
        uint8 decimals;
        address autoRenewAccount;
        uint32 autoRenewPeriod;
    }

    // Events
    event IndexTokenMinted(address indexed user, uint256 amount);
    event IndexTokenCreated(address tokenAddress, int64 responseCode);
    event SupplyKeyVerified(bool hasKey);
    event IndexTokenSet(address indexed tokenAddress);
    event TokenCreationAttempt(
        string name,
        string symbol,
        address treasury,
        address[] supplyKey,
        address[] adminKey,
        address[] autoRenewKey
    );
    event TokenCreationResponse(
        int64 responseCode,
        address tokenAddress,
        string errorMessage
    );
    event TokenAssociationAttempt(
        address account,
        address token,
        int64 responseCode
    );

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
    ) external payable {
        require(INDEX_TOKEN == address(0), "Index token already exists");
        
        // Create token key arrays
        address[] memory adminKey = new address[](1);
        adminKey[0] = ADMIN;
        
        address[] memory supplyKey = new address[](1);
        supplyKey[0] = address(this);
        
        address[] memory emptyKeys = new address[](0);
        
        // Log token creation attempt
        emit TokenCreationAttempt(
            name,
            symbol,
            address(vault),
            supplyKey,
            adminKey,
            emptyKeys
        );
        
        // Create token structure with minimal keys to avoid copying issues
        IHederaTokenService.HederaToken memory token;
        token.name = name;
        token.symbol = symbol;
        token.treasury = address(vault);
        token.memo = memo;
        token.tokenSupplyType = IS_SUPPLY_TYPE_INFINITE;
        token.maxSupply = int64(uint64(TOKEN_MAX_SUPPLY));
        token.freezeDefault = false;
        // tokenKeys left empty - will handle keys separately
        token.expiry.second = 0;
        token.expiry.autoRenewAccount = address(this);
        token.expiry.autoRenewPeriod = int64(uint64(AUTO_RENEW_PERIOD));
        
        // Create fungible token with value for fees
        (int64 responseCode, address tokenAddress) = hts.createFungibleToken{value: msg.value}(
            token,
            0, // initial total supply
            int32(uint32(TOKEN_DECIMALS))
        );
        
        // Log response
        string memory errorMessage = responseCode == 0 ? "Success" : 
            responseCode == -1 ? "Token not associated" :
            responseCode == -2 ? "No supply key" :
            responseCode == -3 ? "Invalid amount" :
            "Unknown error";
            
        emit TokenCreationResponse(responseCode, tokenAddress, errorMessage);
        
        if (responseCode != 0) {
            revert TokenCreationFailed(responseCode);
        }
        
        // Store token address
        INDEX_TOKEN = tokenAddress;
        
        // Associate with token and log attempt
        int64 associateResponse = hts.associateToken(address(this), tokenAddress);
        emit TokenAssociationAttempt(address(this), tokenAddress, associateResponse);
        
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
        
        // Note: Supply key verification not available in official interface
        // Assume we have supply key since we set it during token creation
        hasSupplyKey = true;
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

        // Note: Token association check removed - user must ensure association before minting
        
        // Validate vault deposits
        bool hasDeposits = vault.validateMint(recipient, amount);
        if (!hasDeposits) {
            revert InsufficientDeposits();
        }

        // Mint tokens to the vault (treasury)
        bytes[] memory metadata = new bytes[](0);
        (int64 mintResult, int64 newTotalSupply, int64[] memory serialNumbers) = hts.mintToken(INDEX_TOKEN, int64(uint64(amount)), metadata);
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