// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "../index-token/interfaces/IHederaTokenService.sol";

contract SimpleTokenMinter {
    address private constant HTS_PRECOMPILE = address(0x0000000000000000000000000000000000000167);
    IHederaTokenService private hts;
    
    // Store token address for minting
    address public tokenAddress;
    
    event MintSuccessful(address token, int64 amount, int responseCode);
    event TokenSet(address previousToken, address newToken);

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
    
    // Mint tokens - requires this contract to be the supply key
    function mintTokens(int64 amount) external {
        require(tokenAddress != address(0), "Token address not set");
        require(amount > 0, "Amount must be greater than 0");
        
        int responseCode = hts.mintToken(tokenAddress, uint64(amount), new bytes[](0));
        
        emit MintSuccessful(tokenAddress, amount, responseCode);
        
        require(responseCode == 0, "Mint failed");
    }
    
    // Get token balance of this contract
    function getTokenBalance() external view returns (uint256) {
        require(tokenAddress != address(0), "Token address not set");
        
        return hts.balanceOf(tokenAddress, address(this));
    }
} 