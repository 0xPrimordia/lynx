// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./HederaResponseCodes.sol";

// Proper HTS interface from documentation (same as DepositMinter)
interface IHederaTokenService {
    function associateToken(address account, address token) external returns (int64 responseCode);
    function transferToken(address token, address from, address to, int64 amount) external returns (int64 responseCode);
    function mintToken(address token, int64 amount, bytes[] memory metadata) external returns (int64 responseCode, int64 newTotalSupply, int64[] memory serialNumbers);
    function isAssociated(address account, address token) external returns (int64 responseCode, bool associated);
    function isToken(address token) external returns (int64 responseCode, bool isToken);
    function transferFrom(address token, address from, address to, int64 amount) external returns (int64 responseCode);
}

/**
 * @title SimpleTokenMinter
 * @dev Simple token minter for testing HTS minting functionality
 * Following proper Hedera HTS patterns from documentation
 */
contract SimpleTokenMinter {
    
    // HTS precompile interface
    IHederaTokenService private hts;
    address constant HTS_PRECOMPILE = 0x0000000000000000000000000000000000000167;
    
    // Token address to mint
    address public tokenAddress;
    
    // Events
    event TokenSet(address token);
    event TokenAssociated(address token, int64 responseCode);
    event MintSuccessful(address token, int64 amount, int64 responseCode, int64 newTotalSupply);
    event MintFailed(address token, int64 amount, int64 responseCode);
    
    // Errors
    error TokenNotSet();
    error InvalidAmount();
    error HTSOperationFailed(string operation, int64 responseCode);
    
    constructor() {
        hts = IHederaTokenService(HTS_PRECOMPILE);
    }
    
    // Allow contract to receive HBAR
    receive() external payable {}
    
    // Set token address
    function setTokenAddress(address _tokenAddress) external {
        tokenAddress = _tokenAddress;
        emit TokenSet(_tokenAddress);
    }
    
    // Associate contract with the token - following DepositMinter pattern
    function associateTokens() external {
        if (tokenAddress == address(0)) revert TokenNotSet();
        
        int64 response = hts.associateToken(address(this), tokenAddress);
        emit TokenAssociated(tokenAddress, response);
        
        if (response != HederaResponseCodes.SUCCESS && response != HederaResponseCodes.TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT) {
            revert HTSOperationFailed("Token association", response);
        }
    }
    
    // Check if contract is associated with the token
    function checkAssociation() external returns (bool) {
        if (tokenAddress == address(0)) revert TokenNotSet();
        
        (int64 responseCode, bool associated) = hts.isAssociated(address(this), tokenAddress);
        return (responseCode == HederaResponseCodes.SUCCESS && associated);
    }
    
    // Mint tokens - requires this contract to be the supply key
    function mintTokens(int64 amount) external {
        if (tokenAddress == address(0)) revert TokenNotSet();
        if (amount <= 0) revert InvalidAmount();
        
        bytes[] memory metadata = new bytes[](0);
        (int64 responseCode, int64 newTotalSupply, int64[] memory serialNumbers) = hts.mintToken(tokenAddress, amount, metadata);
        
        if (responseCode == HederaResponseCodes.SUCCESS) {
            emit MintSuccessful(tokenAddress, amount, responseCode, newTotalSupply);
        } else {
            emit MintFailed(tokenAddress, amount, responseCode);
            revert HTSOperationFailed("Token mint", responseCode);
        }
    }
} 