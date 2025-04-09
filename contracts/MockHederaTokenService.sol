// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./IHederaTokenService.sol";

contract MockHederaTokenService {
    // Struct to record token transfers
    struct Transfer {
        address from;
        address to;
        uint256 amount;
    }

    // Storage
    mapping(address => mapping(address => uint256)) private balances;
    mapping(address => mapping(address => mapping(address => uint256))) private allowances;
    mapping(address => bool) private hasSupplyKey;
    mapping(address => mapping(address => bool)) private tokenAssociations;
    
    // Record of all calls for debugging
    struct Call {
        string functionName;
        address token;
        address from;
        address to;
        uint256 amount;
    }
    
    Call[] public recordedCalls;
    mapping(address => Transfer[]) public tokenTransfers;

    // Setup function to initialize tokens
    function setupTokens(
        address lynxToken,
        address sauceToken,
        address clxyToken,
        address supplyKey
    ) external {
        hasSupplyKey[lynxToken] = true;
        hasSupplyKey[sauceToken] = true;
        hasSupplyKey[clxyToken] = true;
        
        // Record setup
        recordedCalls.push(Call({
            functionName: "setupTokens",
            token: lynxToken,
            from: address(0),
            to: supplyKey,
            amount: 0
        }));
    }

    // Mock the allowance function
    function allowance(
        address token,
        address owner,
        address spender
    ) external view returns (uint256) {
        return allowances[token][owner][spender];
    }

    // Set allowance (test helper)
    function setAllowance(
        address token,
        address owner,
        address spender,
        uint256 amount
    ) external {
        allowances[token][owner][spender] = amount;
        recordedCalls.push(Call({
            functionName: "setAllowance",
            token: token,
            from: owner,
            to: spender,
            amount: amount
        }));
    }

    // Mock token transfer
    function transferToken(
        address token,
        address from,
        address to,
        uint256 amount
    ) external returns (int64) {
        require(allowances[token][from][msg.sender] >= amount, "Insufficient allowance");
        require(tokenAssociations[token][to], "Token not associated with recipient");
        
        balances[token][from] -= amount;
        balances[token][to] += amount;
        allowances[token][from][msg.sender] -= amount;
        
        // Record the transfer
        tokenTransfers[token].push(Transfer({
            from: from,
            to: to,
            amount: amount
        }));
        
        recordedCalls.push(Call({
            functionName: "transferToken",
            token: token,
            from: from,
            to: to,
            amount: amount
        }));
        
        return 0; // Success
    }

    // Get the last transfer for a token
    function getLastTransfer(address token) external view returns (Transfer memory) {
        require(tokenTransfers[token].length > 0, "No transfers");
        return tokenTransfers[token][tokenTransfers[token].length - 1];
    }

    // Get all recorded calls
    function getRecordedCalls() external view returns (Call[] memory) {
        return recordedCalls;
    }

    // Mock mint function
    function mintToken(
        address token,
        uint256 amount,
        bytes[] memory metadata
    ) external returns (int64) {
        require(hasSupplyKey[token], "No supply key");
        
        balances[token][msg.sender] += amount;
        
        recordedCalls.push(Call({
            functionName: "mintToken",
            token: token,
            from: address(0),
            to: msg.sender,
            amount: amount
        }));
        
        return 0; // Success
    }

    // Mock burn function
    function burnToken(
        address token,
        uint256 amount,
        bytes[] memory metadata
    ) external returns (int64) {
        require(hasSupplyKey[token], "No supply key");
        require(balances[token][msg.sender] >= amount, "Insufficient balance");
        
        balances[token][msg.sender] -= amount;
        
        recordedCalls.push(Call({
            functionName: "burnToken",
            token: token,
            from: msg.sender,
            to: address(0),
            amount: amount
        }));
        
        return 0; // Success
    }

    // Mock associate token
    function associateToken(
        address account,
        address token
    ) external returns (int64) {
        tokenAssociations[token][account] = true;
        
        recordedCalls.push(Call({
            functionName: "associateToken",
            token: token,
            from: address(0),
            to: account,
            amount: 0
        }));
        
        return 0; // Success
    }

    // Mock disassociate token
    function disassociateToken(
        address account,
        address token
    ) external returns (int64) {
        tokenAssociations[token][account] = false;
        
        recordedCalls.push(Call({
            functionName: "disassociateToken",
            token: token,
            from: account,
            to: address(0),
            amount: 0
        }));
        
        return 0; // Success
    }

    // Mock balance check
    function balanceOf(
        address token,
        address account
    ) external view returns (uint256) {
        return balances[token][account];
    }

    // Mock isSupplyKey check
    function isSupplyKey(
        address token,
        address supplyAddress
    ) external view returns (bool) {
        return hasSupplyKey[token];
    }

    // Mock isTokenAssociated check
    function isTokenAssociated(
        address account,
        address token
    ) external view returns (bool) {
        return tokenAssociations[token][account];
    }

    // Mock createToken
    function createToken(
        IHederaTokenService.HederaToken memory token,
        uint initialTotalSupply,
        uint8[] memory keys,
        address[] memory keyAddresses
    ) external payable returns (int64 responseCode, address tokenAddress) {
        // For testing purposes, we'll just return a success code and a dummy address
        return (0, address(0x123));
    }
} 