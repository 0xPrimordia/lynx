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
 * @title DepositMinterV2
 * @dev Updated token minter that accepts 6-token deposits and mints proportional LYNX tokens
 * Based on current DAO parameters snapshot:
 * - HBAR: 25% (2.5 HBAR per 1 LYNX)
 * - WBTC: 20% (0.02 WBTC per 1 LYNX)
 * - SAUCE: 15% (1.5 SAUCE per 1 LYNX) 
 * - USDC: 15% (1.5 USDC per 1 LYNX)
 * - JAM: 15% (1.5 JAM per 1 LYNX)
 * - HEADSTART: 10% (1.0 HEADSTART per 1 LYNX)
 */
contract DepositMinterV2 {
    
    // HTS precompile interface
    IHederaTokenService private hts;
    address constant HTS_PRECOMPILE = 0x0000000000000000000000000000000000000167;
    
    // Token addresses (immutable after constructor)
    address public LYNX_TOKEN;
    address public WBTC_TOKEN;
    address public SAUCE_TOKEN;
    address public USDC_TOKEN;
    address public JAM_TOKEN;
    address public HEADSTART_TOKEN;
    
    // Admin address (set in constructor)
    address public ADMIN;
    
    // Treasury address - where minted tokens go (usually the operator account)
    address public TREASURY;
    
    // Minting ratios (tokens required per 1 LYNX)
    uint256 public constant HBAR_RATIO = 25;      // 2.5 HBAR per 1 LYNX (25 tinybars per 10^7 LYNX base units)
    uint256 public constant WBTC_RATIO = 2;       // 0.02 WBTC per 1 LYNX (2 satoshi per 10^6 LYNX base units)
    uint256 public constant SAUCE_RATIO = 15;     // 1.5 SAUCE per 1 LYNX (15 per 10 LYNX)
    uint256 public constant USDC_RATIO = 15;      // 1.5 USDC per 1 LYNX (15 per 10 LYNX)
    uint256 public constant JAM_RATIO = 15;       // 1.5 JAM per 1 LYNX (15 per 10 LYNX)
    uint256 public constant HEADSTART_RATIO = 10; // 1.0 HEADSTART per 1 LYNX (10 per 10 LYNX)
    
    // Token decimals
    uint8 public constant SAUCE_DECIMALS = 6;
    uint8 public constant USDC_DECIMALS = 6;
    uint8 public constant JAM_DECIMALS = 8;
    uint8 public constant HEADSTART_DECIMALS = 8;
    uint8 public constant WBTC_DECIMALS = 8;
    uint8 public constant LYNX_DECIMALS = 8;
    
    // Events
    event TokensAssociated(address token, int64 responseCode);
    event TokensDeposited(
        address indexed user, 
        uint256 hbarAmount, 
        uint256 wbtcAmount, 
        uint256 sauceAmount, 
        uint256 usdcAmount, 
        uint256 jamAmount, 
        uint256 headstartAmount
    );
    event LynxMinted(address indexed user, uint256 lynxAmount);
    event MintAttempt(address indexed user, uint256 lynxAmount, uint256 lynxBaseUnits);
    event MintResult(int64 responseCode, int64 newTotalSupply);
    event TransferAttempt(address from, address to, uint256 amount);
    event TransferResult(int64 responseCode);
    event DepositsProcessed(address indexed user, uint256 totalTokensProcessed);
    
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
    
    constructor(
        address lynxToken,
        address wbtcToken,
        address sauceToken,
        address usdcToken,
        address jamToken,
        address headstartToken,
        address treasury
    ) {
        hts = IHederaTokenService(HTS_PRECOMPILE);
        LYNX_TOKEN = lynxToken;
        WBTC_TOKEN = wbtcToken;
        SAUCE_TOKEN = sauceToken;
        USDC_TOKEN = usdcToken;
        JAM_TOKEN = jamToken;
        HEADSTART_TOKEN = headstartToken;
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
        
        // Associate with WBTC token
        int64 wbtcResponse = hts.associateToken(address(this), WBTC_TOKEN);
        emit TokensAssociated(WBTC_TOKEN, wbtcResponse);
        
        // Associate with SAUCE token
        int64 sauceResponse = hts.associateToken(address(this), SAUCE_TOKEN);
        emit TokensAssociated(SAUCE_TOKEN, sauceResponse);
        
        // Associate with USDC token
        int64 usdcResponse = hts.associateToken(address(this), USDC_TOKEN);
        emit TokensAssociated(USDC_TOKEN, usdcResponse);
        
        // Associate with JAM token
        int64 jamResponse = hts.associateToken(address(this), JAM_TOKEN);
        emit TokensAssociated(JAM_TOKEN, jamResponse);
        
        // Associate with HEADSTART token
        int64 headstartResponse = hts.associateToken(address(this), HEADSTART_TOKEN);
        emit TokensAssociated(HEADSTART_TOKEN, headstartResponse);
    }
    
    /**
     * @dev Check if contract is associated with all tokens
     */
    function checkAssociations() external returns (
        bool lynxAssociated,
        bool wbtcAssociated,
        bool sauceAssociated,
        bool usdcAssociated,
        bool jamAssociated,
        bool headstartAssociated
    ) {
        (int64 lynxCode, bool lynxResult) = hts.isAssociated(address(this), LYNX_TOKEN);
        lynxAssociated = (lynxCode == HederaResponseCodes.SUCCESS && lynxResult);
        
        (int64 wbtcCode, bool wbtcResult) = hts.isAssociated(address(this), WBTC_TOKEN);
        wbtcAssociated = (wbtcCode == HederaResponseCodes.SUCCESS && wbtcResult);
        
        (int64 sauceCode, bool sauceResult) = hts.isAssociated(address(this), SAUCE_TOKEN);
        sauceAssociated = (sauceCode == HederaResponseCodes.SUCCESS && sauceResult);
        
        (int64 usdcCode, bool usdcResult) = hts.isAssociated(address(this), USDC_TOKEN);
        usdcAssociated = (usdcCode == HederaResponseCodes.SUCCESS && usdcResult);
        
        (int64 jamCode, bool jamResult) = hts.isAssociated(address(this), JAM_TOKEN);
        jamAssociated = (jamCode == HederaResponseCodes.SUCCESS && jamResult);
        
        (int64 headstartCode, bool headstartResult) = hts.isAssociated(address(this), HEADSTART_TOKEN);
        headstartAssociated = (headstartCode == HederaResponseCodes.SUCCESS && headstartResult);
    }
    
    /**
     * @dev Calculate required deposits for a given LYNX amount
     */
    function calculateRequiredDeposits(uint256 lynxAmount) 
        external 
        pure 
        returns (
            uint256 hbarRequired,
            uint256 wbtcRequired,
            uint256 sauceRequired,
            uint256 usdcRequired,
            uint256 jamRequired,
            uint256 headstartRequired
        ) 
    {
        // Calculate based on hardcoded ratios
        hbarRequired = lynxAmount * HBAR_RATIO * (10 ** 8) / 10; // 2.5 HBAR per LYNX
        wbtcRequired = lynxAmount * WBTC_RATIO * (10 ** WBTC_DECIMALS) / 100; // 0.02 WBTC per LYNX
        sauceRequired = lynxAmount * SAUCE_RATIO * (10 ** SAUCE_DECIMALS) / 10; // 1.5 SAUCE per LYNX
        usdcRequired = lynxAmount * USDC_RATIO * (10 ** USDC_DECIMALS) / 10; // 1.5 USDC per LYNX
        jamRequired = lynxAmount * JAM_RATIO * (10 ** JAM_DECIMALS) / 10; // 1.5 JAM per LYNX
        headstartRequired = lynxAmount * HEADSTART_RATIO * (10 ** HEADSTART_DECIMALS) / 10; // 1.0 HEADSTART per LYNX
    }
    
    /**
     * @dev Mint LYNX tokens by depositing all 6 tokens + HBAR
     */
    function mintWithDeposits(
        uint256 lynxAmount,
        uint256 wbtcAmount,
        uint256 sauceAmount,
        uint256 usdcAmount,
        uint256 jamAmount,
        uint256 headstartAmount
    ) external payable {
        _validateMintInputs(lynxAmount, wbtcAmount, sauceAmount, usdcAmount, jamAmount, headstartAmount);
        _processDeposits(wbtcAmount, sauceAmount, usdcAmount, jamAmount, headstartAmount);
        _mintAndTransfer(lynxAmount);
    }
    
    /**
     * @dev Internal function to validate mint inputs
     */
    function _validateMintInputs(
        uint256 lynxAmount,
        uint256 wbtcAmount,
        uint256 sauceAmount,
        uint256 usdcAmount,
        uint256 jamAmount,
        uint256 headstartAmount
    ) internal view {
        if (lynxAmount == 0) revert InvalidAmount();
        if (LYNX_TOKEN == address(0)) revert TokenNotSet("LYNX");
        if (WBTC_TOKEN == address(0)) revert TokenNotSet("WBTC");
        if (SAUCE_TOKEN == address(0)) revert TokenNotSet("SAUCE");
        if (USDC_TOKEN == address(0)) revert TokenNotSet("USDC");
        if (JAM_TOKEN == address(0)) revert TokenNotSet("JAM");
        if (HEADSTART_TOKEN == address(0)) revert TokenNotSet("HEADSTART");
        
        // Calculate required amounts
        (
            uint256 hbarRequired,
            uint256 wbtcRequired,
            uint256 sauceRequired,
            uint256 usdcRequired,
            uint256 jamRequired,
            uint256 headstartRequired
        ) = this.calculateRequiredDeposits(lynxAmount);
        
        // Validate deposits
        if (msg.value < hbarRequired) {
            revert InsufficientDeposit("HBAR", hbarRequired, msg.value);
        }
        if (wbtcAmount < wbtcRequired) {
            revert InsufficientDeposit("WBTC", wbtcRequired, wbtcAmount);
        }
        if (sauceAmount < sauceRequired) {
            revert InsufficientDeposit("SAUCE", sauceRequired, sauceAmount);
        }
        if (usdcAmount < usdcRequired) {
            revert InsufficientDeposit("USDC", usdcRequired, usdcAmount);
        }
        if (jamAmount < jamRequired) {
            revert InsufficientDeposit("JAM", jamRequired, jamAmount);
        }
        if (headstartAmount < headstartRequired) {
            revert InsufficientDeposit("HEADSTART", headstartRequired, headstartAmount);
        }
    }
    
    /**
     * @dev Internal function to process token deposits using HTS
     */
    function _processDeposits(
        uint256 wbtcAmount,
        uint256 sauceAmount,
        uint256 usdcAmount,
        uint256 jamAmount,
        uint256 headstartAmount
    ) internal {
        uint256 tokensProcessed = 0;
        
        // Transfer WBTC tokens using HTS
        int64 wbtcResponse = hts.transferToken(WBTC_TOKEN, msg.sender, address(this), int64(uint64(wbtcAmount)));
        if (wbtcResponse != HederaResponseCodes.SUCCESS) {
            revert HTSOperationFailed("WBTC transfer", wbtcResponse);
        }
        tokensProcessed++;
        
        // Transfer SAUCE tokens using HTS
        int64 sauceResponse = hts.transferToken(SAUCE_TOKEN, msg.sender, address(this), int64(uint64(sauceAmount)));
        if (sauceResponse != HederaResponseCodes.SUCCESS) {
            revert HTSOperationFailed("SAUCE transfer", sauceResponse);
        }
        tokensProcessed++;
        
        // Transfer USDC tokens using HTS
        int64 usdcResponse = hts.transferToken(USDC_TOKEN, msg.sender, address(this), int64(uint64(usdcAmount)));
        if (usdcResponse != HederaResponseCodes.SUCCESS) {
            revert HTSOperationFailed("USDC transfer", usdcResponse);
        }
        tokensProcessed++;
        
        // Transfer JAM tokens using HTS
        int64 jamResponse = hts.transferToken(JAM_TOKEN, msg.sender, address(this), int64(uint64(jamAmount)));
        if (jamResponse != HederaResponseCodes.SUCCESS) {
            revert HTSOperationFailed("JAM transfer", jamResponse);
        }
        tokensProcessed++;
        
        // Transfer HEADSTART tokens using HTS
        int64 headstartResponse = hts.transferToken(HEADSTART_TOKEN, msg.sender, address(this), int64(uint64(headstartAmount)));
        if (headstartResponse != HederaResponseCodes.SUCCESS) {
            revert HTSOperationFailed("HEADSTART transfer", headstartResponse);
        }
        tokensProcessed++;
        
        emit DepositsProcessed(msg.sender, tokensProcessed);
        emit TokensDeposited(msg.sender, msg.value, wbtcAmount, sauceAmount, usdcAmount, jamAmount, headstartAmount);
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
            revert HTSOperationFailed("LYNX transfer from treasury", transferResponse);
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