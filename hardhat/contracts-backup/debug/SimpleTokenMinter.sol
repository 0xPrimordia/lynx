// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../HederaResponseCodes.sol";

// Proper HTS interface from documentation
interface IHederaTokenService {
    function associateToken(address account, address token) external returns (int64 responseCode);
    function transferToken(address token, address from, address to, int64 amount) external returns (int64 responseCode);
    function mintToken(address token, int64 amount, bytes[] memory metadata) external returns (int64 responseCode, int64 newTotalSupply, int64[] memory serialNumbers);
    function isAssociated(address account, address token) external returns (int64 responseCode, bool associated);
    function isToken(address token) external returns (int64 responseCode, bool isToken);
    function transferFrom(address token, address from, address to, int64 amount) external returns (int64 responseCode);
}

contract SimpleTokenMinter {
    address private constant HTS_PRECOMPILE = address(0x0000000000000000000000000000000000000167);
    IHederaTokenService private hts;
    
    // Store token address for minting
    address public tokenAddress;
    
    event MintSuccessful(address token, int64 amount, int responseCode);
    event TokenSet(address previousToken, address newToken);
    event TokenAssociated(address token, int64 responseCode);

    constructor() {
        hts = IHederaTokenService(HTS_PRECOMPILE);
    }
    
    // Allow the contract to receive HBAR
    receive() external payable {}
    
    // Set the token address
    function setTokenAddress(address _tokenAddress) external {
        address previousToken = tokenAddress;
        tokenAddress = _tokenAddress;
        emit TokenSet(previousToken, _tokenAddress);
    }
    
    // Associate contract with the token - following DepositMinter pattern
    function associateTokens() external {
        require(tokenAddress != address(0), "Token address not set");
        
        int64 response = hts.associateToken(address(this), tokenAddress);
        emit TokenAssociated(tokenAddress, response);
    }
    
    // Check if contract is associated with the token
    function checkAssociation() external returns (bool) {
        require(tokenAddress != address(0), "Token address not set");
        
        (int64 responseCode, bool associated) = hts.isAssociated(address(this), tokenAddress);
        return (responseCode == HederaResponseCodes.SUCCESS && associated);
    }
    
    // Mint tokens - requires this contract to be the supply key
    function mintTokens(int64 amount) external {
        require(tokenAddress != address(0), "Token address not set");
        require(amount > 0, "Amount must be greater than 0");
        
        bytes[] memory metadata = new bytes[](0);
        (int64 responseCode, int64 newTotalSupply, int64[] memory serialNumbers) = hts.mintToken(tokenAddress, int64(uint64(amount)), metadata);
        
        emit MintSuccessful(tokenAddress, amount, responseCode);
        
        require(responseCode == HederaResponseCodes.SUCCESS, "Mint failed");
    }
    
    // Get token balance of this contract - removed due to interface complexity
    // Use mirror node API to check balances instead
} 