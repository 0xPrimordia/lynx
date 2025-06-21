// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../contracts/IHederaTokenService.sol";

/**
 * @title IndexVault
 * @dev Treasury contract for the index token, handling token custody and composition logic
 */
contract IndexVault {
    // Constants
    address public constant HTS_PRECOMPILE = 0x0000000000000000000000000000000000000167;
    
    // Token addresses
    address public indexToken;
    
    // Contract references
    address public controller;
    address public admin;
    
    // Composition management
    struct Asset {
        address token;
        uint16 weight; // in basis points (e.g., 5000 = 50%)
    }
    Asset[] public composition;
    
    // User deposits tracking
    mapping(address => mapping(address => uint256)) public deposits; // user => token => amount
    
    // HTS interaction
    IHederaTokenService private hts;
    
    // Events
    event DepositReceived(address indexed user, address indexed token, uint256 amount);
    event TokensDistributed(address indexed user, uint256 amount);
    event CompositionUpdated(Asset[] composition);
    event IndexTokenSet(address indexed tokenAddress);
    
    // Errors
    error OnlyController();
    error OnlyAdmin();
    error TokenNotAssociated(address token, address account);
    error InsufficientDeposit(address token, uint256 required, uint256 actual);
    error TransferFailed(address token, int64 responseCode);
    error InvalidComposition();
    
    modifier onlyController() {
        if (msg.sender != controller) {
            revert OnlyController();
        }
        _;
    }
    
    modifier onlyAdmin() {
        if (msg.sender != admin) {
            revert OnlyAdmin();
        }
        _;
    }
    
    /**
     * @dev Constructor to initialize the vault
     * @param _controller Address of the IndexTokenController that can call this vault
     */
    constructor(address _controller) {
        controller = _controller;
        admin = msg.sender;
        hts = IHederaTokenService(HTS_PRECOMPILE);
        indexToken = address(0);
    }
    
    /**
     * @dev Set the index token address - can only be called once
     * @param _indexToken The address of the index token
     */
    function setIndexToken(address _indexToken) external onlyController {
        require(_indexToken != address(0), "Cannot set to zero address");
        require(indexToken == address(0), "Index token already set");
        
        indexToken = _indexToken;
        emit IndexTokenSet(_indexToken);
    }
    
    /**
     * @dev Set the composition of the index - which tokens and their weights
     * @param _composition Array of assets and their weights in basis points
     */
    function setComposition(Asset[] calldata _composition) external onlyAdmin {
        // Validate that weights sum to 10000 (100%)
        uint256 totalWeight = 0;
        for (uint i = 0; i < _composition.length; i++) {
            totalWeight += _composition[i].weight;
            
            // Associate each token with this contract (will succeed if already associated)
            int64 associateResponse = hts.associateToken(address(this), _composition[i].token);
            if (associateResponse != 22 && associateResponse != 173) { // SUCCESS or ALREADY_ASSOCIATED
                revert TransferFailed(_composition[i].token, associateResponse);
            }
        }
        
        if (totalWeight != 10000) {
            revert InvalidComposition();
        }
        
        // Clear existing composition
        if (composition.length > 0) {
            delete composition;
        }
        
        // Set new composition
        for (uint i = 0; i < _composition.length; i++) {
            composition.push(_composition[i]);
        }
        
        emit CompositionUpdated(_composition);
    }
    
    /**
     * @dev Validates if a user can mint the specified amount based on their deposits
     * @param user The user address to check
     * @param amount The amount of index tokens to mint
     * @return Whether the user can mint the specified amount
     */
    function validateMint(address user, uint256 amount) external view returns (bool) {
        // Short circuit if composition isn't set
        if (composition.length == 0) {
            return false;
        }
        
        // Check user has sufficient deposits for each asset in the composition
        for (uint i = 0; i < composition.length; i++) {
            Asset memory asset = composition[i];
            uint256 requiredAmount = (amount * asset.weight) / 10000;
            
            if (deposits[user][asset.token] < requiredAmount) {
                return false;
            }
        }
        
        return true;
    }
    
    /**
     * @dev Receive minted tokens from controller and distribute to user
     * @param user The user to receive the tokens
     * @param amount The amount of tokens to distribute
     */
    function receiveMint(address user, uint256 amount) external onlyController {
        require(indexToken != address(0), "Index token not set");
        
        // Verify the user has provided sufficient deposits
        for (uint i = 0; i < composition.length; i++) {
            Asset memory asset = composition[i];
            uint256 requiredAmount = (amount * asset.weight) / 10000;
            
            if (deposits[user][asset.token] < requiredAmount) {
                revert InsufficientDeposit(asset.token, requiredAmount, deposits[user][asset.token]);
            }
            
            // Deduct the deposit - tokens stay in vault
            deposits[user][asset.token] -= requiredAmount;
        }
        
                // Transfer the minted index tokens to the user
        // Note: User must be associated with index token before calling this function
        int64 transferResult = hts.transferToken(indexToken, address(this), user, int64(uint64(amount)));
        if (transferResult != 0) {
            revert TransferFailed(indexToken, transferResult);
        }
        
        emit TokensDistributed(user, amount);
    }
    
    /**
     * @dev Deposit backing assets into the vault
     * @param token The token address to deposit
     * @param amount The amount to deposit
     */
    function depositAsset(address token, uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        
        // Check if token is part of composition
        bool isValidToken = false;
        for (uint i = 0; i < composition.length; i++) {
            if (composition[i].token == token) {
                isValidToken = true;
                break;
            }
        }
        require(isValidToken, "Token not part of composition");
        
                // Note: Contract must be associated with token before accepting deposits
        
        // Transfer tokens from user to vault
        int64 transferResult = hts.transferToken(token, msg.sender, address(this), int64(uint64(amount)));
        if (transferResult != 0) {
            revert TransferFailed(token, transferResult);
        }
        
        // Update user's deposit record
        deposits[msg.sender][token] += amount;
        
        emit DepositReceived(msg.sender, token, amount);
    }
    
    /**
     * @dev Calculate required deposit amounts for minting a specific amount of index tokens
     * @param amount The amount of index tokens to mint
     * @return tokens Array of token addresses required
     * @return amounts Array of required amounts for each token
     */
    function calculateRequiredDeposits(uint256 amount) 
        external 
        view 
        returns (address[] memory tokens, uint256[] memory amounts) 
    {
        tokens = new address[](composition.length);
        amounts = new uint256[](composition.length);
        
        for (uint i = 0; i < composition.length; i++) {
            tokens[i] = composition[i].token;
            amounts[i] = (amount * composition[i].weight) / 10000;
        }
        
        return (tokens, amounts);
    }
    
    /**
     * @dev Get user's deposit for a specific token
     * @param user The user address to check
     * @param token The token address to check
     * @return The amount of the token deposited by the user
     */
    function getDeposit(address user, address token) external view returns (uint256) {
        return deposits[user][token];
    }
    
    /**
     * @dev Update controller address - for future upgrades
     * @param newController The new controller address
     */
    function updateController(address newController) external onlyAdmin {
        require(newController != address(0), "Cannot set to zero address");
        controller = newController;
    }
    
    /**
     * @dev Update admin address - for future DAO governance
     * @param newAdmin The new admin address
     */
    function updateAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Cannot set to zero address");
        admin = newAdmin;
    }
    
    /**
     * @dev Get composition info
     * @return Full composition array
     */
    function getComposition() external view returns (Asset[] memory) {
        return composition;
    }
    
    // Allow contract to receive HBAR
    receive() external payable {}
} 