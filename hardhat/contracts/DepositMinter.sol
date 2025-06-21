// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./HederaResponseCodes.sol";

// Proper HTS interface from documentation
interface IHederaTokenService {
    function associateToken(address account, address token) external returns (int64 responseCode);
    function transferToken(address token, address from, address to, int64 amount) external returns (int64 responseCode);
    function mintToken(address token, int64 amount, bytes[] memory metadata) external returns (int64 responseCode, int64 newTotalSupply, int64[] memory serialNumbers);
    function isAssociated(address account, address token) external returns (int64 responseCode, bool associated);
    function isToken(address token) external returns (int64 responseCode, bool isToken);
    function transferFrom(address token, address from, address to, int64 amount) external returns (int64 responseCode);
}

/**
 * @title DepositMinter
 * @dev Token minter that accepts SAUCE/CLXY deposits and mints proportional LYNX tokens
 * Following proper Hedera HTS patterns from documentation
 */
contract DepositMinter {
    
    // HTS precompile interface
    IHederaTokenService private hts;
    address constant HTS_PRECOMPILE = 0x0000000000000000000000000000000000000167;
    
    // Token addresses (immutable after constructor)
    address public LYNX_TOKEN;
    address public SAUCE_TOKEN;
    address public CLXY_TOKEN;
    
    // Admin address (set in constructor)
    address public ADMIN;
    
    // Treasury address - where minted tokens go (usually the operator account)
    address public TREASURY;
    
    // Minting ratios (tokens required per 1 LYNX)
    uint256 public constant SAUCE_RATIO = 5;  // 5 SAUCE per 1 LYNX
    uint256 public constant CLXY_RATIO = 2;   // 2 CLXY per 1 LYNX
    uint256 public constant HBAR_RATIO = 10;  // 10 HBAR per 1 LYNX
    
    // Token decimals
    uint8 public constant SAUCE_DECIMALS = 6;  // SAUCE has 6 decimals
    uint8 public constant CLXY_DECIMALS = 6;   // CLXY has 6 decimals
    uint8 public constant LYNX_DECIMALS = 8;   // LYNX has 8 decimals
    
    // Events
    event TokensAssociated(address token, int64 responseCode);
    event TokensDeposited(address indexed user, uint256 sauceAmount, uint256 clxyAmount, uint256 hbarAmount);
    event LynxMinted(address indexed user, uint256 lynxAmount);
    event MintAttempt(address indexed user, uint256 lynxAmount, uint256 lynxBaseUnits);
    event MintResult(int64 responseCode, int64 newTotalSupply);
    event TransferAttempt(address from, address to, uint256 amount);
    event TransferResult(int64 responseCode);
    event DepositsProcessed(address indexed user, uint256 sauceAmount, uint256 clxyAmount);
    
    // Errors
    error OnlyAdmin();
    error InvalidAmount();
    error TokenNotSet(string tokenType);
    error InsufficientDeposit(string tokenType, uint256 required, uint256 provided);
    error HTSOperationFailed(string operation, int64 responseCode);
    
    modifier onlyAdmin() {
        if (msg.sender != ADMIN) {
            revert OnlyAdmin();
        }
        _;
    }
    
    constructor(address lynxToken, address sauceToken, address clxyToken, address treasury) {
        hts = IHederaTokenService(HTS_PRECOMPILE);
        LYNX_TOKEN = lynxToken;
        SAUCE_TOKEN = sauceToken;
        CLXY_TOKEN = clxyToken;
        ADMIN = msg.sender; // Deployer becomes admin
        TREASURY = treasury; // Treasury address where minted tokens go
    }
    
    /**
     * @dev Associate contract with all tokens - proper HTS pattern
     */
    function associateTokens() external {
        // Associate with LYNX token
        int64 lynxResponse = hts.associateToken(address(this), LYNX_TOKEN);
        emit TokensAssociated(LYNX_TOKEN, lynxResponse);
        
        // Associate with SAUCE token
        int64 sauceResponse = hts.associateToken(address(this), SAUCE_TOKEN);
        emit TokensAssociated(SAUCE_TOKEN, sauceResponse);
        
        // Associate with CLXY token
        int64 clxyResponse = hts.associateToken(address(this), CLXY_TOKEN);
        emit TokensAssociated(CLXY_TOKEN, clxyResponse);
    }
    
    /**
     * @dev Check if contract is associated with all tokens
     */
    function checkAssociations() external returns (
        bool lynxAssociated,
        bool sauceAssociated,
        bool clxyAssociated
    ) {
        (int64 lynxCode, bool lynxResult) = hts.isAssociated(address(this), LYNX_TOKEN);
        lynxAssociated = (lynxCode == HederaResponseCodes.SUCCESS && lynxResult);
        
        (int64 sauceCode, bool sauceResult) = hts.isAssociated(address(this), SAUCE_TOKEN);
        sauceAssociated = (sauceCode == HederaResponseCodes.SUCCESS && sauceResult);
        
        (int64 clxyCode, bool clxyResult) = hts.isAssociated(address(this), CLXY_TOKEN);
        clxyAssociated = (clxyCode == HederaResponseCodes.SUCCESS && clxyResult);
    }
    
    /**
     * @dev Calculate required deposits for a given LYNX amount
     */
    function calculateRequiredDeposits(uint256 lynxAmount) 
        external 
        pure 
        returns (uint256 sauceRequired, uint256 clxyRequired, uint256 hbarRequired) 
    {
        // lynxAmount is whole tokens (1, 2, 3, etc.)
        sauceRequired = lynxAmount * SAUCE_RATIO * (10 ** SAUCE_DECIMALS);
        clxyRequired = lynxAmount * CLXY_RATIO * (10 ** CLXY_DECIMALS);
        hbarRequired = lynxAmount * HBAR_RATIO * (10 ** 8); // tinybars
    }
    
    /**
     * @dev Mint LYNX tokens by depositing SAUCE, CLXY, and HBAR
     */
    function mintWithDeposits(
        uint256 lynxAmount,
        uint256 sauceAmount,
        uint256 clxyAmount
    ) external payable {
        _validateMintInputs(lynxAmount, sauceAmount, clxyAmount);
        _processDeposits(sauceAmount, clxyAmount);
        _mintAndTransfer(lynxAmount);
    }
    
    /**
     * @dev Internal function to validate mint inputs
     */
    function _validateMintInputs(
        uint256 lynxAmount,
        uint256 sauceAmount,
        uint256 clxyAmount
    ) internal view {
        if (lynxAmount == 0) revert InvalidAmount();
        if (LYNX_TOKEN == address(0)) revert TokenNotSet("LYNX");
        if (SAUCE_TOKEN == address(0)) revert TokenNotSet("SAUCE");
        if (CLXY_TOKEN == address(0)) revert TokenNotSet("CLXY");
        
        // Calculate required amounts
        (uint256 sauceRequired, uint256 clxyRequired, uint256 hbarRequired) = this.calculateRequiredDeposits(lynxAmount);
        
        // Validate deposits
        if (sauceAmount < sauceRequired) {
            revert InsufficientDeposit("SAUCE", sauceRequired, sauceAmount);
        }
        if (clxyAmount < clxyRequired) {
            revert InsufficientDeposit("CLXY", clxyRequired, clxyAmount);
        }
        if (msg.value < hbarRequired) {
            revert InsufficientDeposit("HBAR", hbarRequired, msg.value);
        }
    }
    
    /**
     * @dev Internal function to process token deposits using HTS
     */
    function _processDeposits(uint256 sauceAmount, uint256 clxyAmount) internal {
        // Transfer SAUCE tokens using HTS
        int64 sauceResponse = hts.transferToken(SAUCE_TOKEN, msg.sender, address(this), int64(uint64(sauceAmount)));
        if (sauceResponse != HederaResponseCodes.SUCCESS) {
            revert HTSOperationFailed("SAUCE transfer", sauceResponse);
        }
        
        // Transfer CLXY tokens using HTS
        int64 clxyResponse = hts.transferToken(CLXY_TOKEN, msg.sender, address(this), int64(uint64(clxyAmount)));
        if (clxyResponse != HederaResponseCodes.SUCCESS) {
            revert HTSOperationFailed("CLXY transfer", clxyResponse);
        }
        
        emit DepositsProcessed(msg.sender, sauceAmount, clxyAmount);
        emit TokensDeposited(msg.sender, sauceAmount, clxyAmount, msg.value);
    }
    
    /**
     * @dev Internal function to mint and transfer LYNX tokens using HTS
     */
    function _mintAndTransfer(uint256 lynxAmount) internal {
        // Convert to base units for minting
        uint256 lynxBaseUnits = lynxAmount * (10 ** LYNX_DECIMALS);
        
        emit MintAttempt(msg.sender, lynxAmount, lynxBaseUnits);
        
        // Note: User must be associated with LYNX token before calling this function
        
        // Mint LYNX tokens
        bytes[] memory metadata = new bytes[](0);
        (int64 mintResponse, int64 newTotalSupply, ) = hts.mintToken(LYNX_TOKEN, int64(uint64(lynxBaseUnits)), metadata);
        
        emit MintResult(mintResponse, newTotalSupply);
        
        if (mintResponse != HederaResponseCodes.SUCCESS) {
            revert HTSOperationFailed("LYNX mint", mintResponse);
        }
        
        emit TransferAttempt(TREASURY, msg.sender, lynxBaseUnits);
        
        // Transfer minted tokens from treasury to user using transferToken
        // Note: Minted tokens go to the treasury account, so we transfer from treasury
        int64 transferResponse = hts.transferToken(LYNX_TOKEN, TREASURY, msg.sender, int64(uint64(lynxBaseUnits)));
        
        emit TransferResult(transferResponse);
        
        if (transferResponse != HederaResponseCodes.SUCCESS) {
            revert HTSOperationFailed("LYNX transfer from contract", transferResponse);
        }
        
        emit LynxMinted(msg.sender, lynxAmount);
    }
    
    /**
     * @dev Get contract's HBAR balance
     */
    function getHbarBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    /**
     * @dev Emergency withdrawal (admin only)
     */
    function emergencyWithdrawHbar(uint256 amount) external onlyAdmin {
        require(amount <= address(this).balance, "Insufficient HBAR balance");
        payable(ADMIN).transfer(amount);
    }
    
    // Allow contract to receive HBAR
    receive() external payable {}
} 