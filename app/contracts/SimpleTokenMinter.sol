// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./IHederaTokenService.sol";

contract SimpleTokenMinter {
    // Address of the Hedera Token Service precompile
    address constant private HTS_PRECOMPILE = address(0x0000000000000000000000000000000000000167);
    
    // Token address to mint to
    address public tokenAddress;
    
    // Events
    event TokenSet(address token);
    event MintAttempted(address token, uint64 amount);
    event MintResult(bool success, bytes result);
    
    // Constructor
    constructor() {}
    
    // Receive HBAR
    receive() external payable {}
    
    // Set token address
    function setTokenAddress(address _tokenAddress) external {
        tokenAddress = _tokenAddress;
        emit TokenSet(_tokenAddress);
    }
    
    // Most basic way to mint tokens - using lowest level call
    function basicMint(uint64 amount) external {
        require(tokenAddress != address(0), "Token address not set");
        
        // Log attempt
        emit MintAttempted(tokenAddress, amount);
        
        // Prepare empty metadata array
        bytes[] memory emptyMetadata = new bytes[](0);
        
        // Create function selector for mintToken
        bytes4 mintSelector = bytes4(keccak256("mintToken(address,uint64,bytes[])"));
        
        // Encode parameters for the function call
        bytes memory callData = abi.encodeWithSelector(
            mintSelector,
            tokenAddress,
            amount,
            emptyMetadata
        );
        
        // Direct low-level call to the HTS precompile
        (bool success, bytes memory result) = HTS_PRECOMPILE.call(callData);
        
        // Emit result
        emit MintResult(success, result);
    }
} 