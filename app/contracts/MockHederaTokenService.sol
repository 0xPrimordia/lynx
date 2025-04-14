// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./IHederaTokenService.sol";

/**
 * @title MockHederaTokenService
 * @dev Mock implementation of the Hedera Token Service for testing
 */
contract MockHederaTokenService is IHederaTokenService {
    // Mock state
    mapping(address => bool) private supplyKeys;
    mapping(address => mapping(address => bool)) private tokenAssociations;
    mapping(address => uint256) private tokenBalances;
    mapping(address => mapping(address => mapping(address => uint256))) private allowances;
    mapping(address => int64) private transferResults;
    mapping(address => HederaToken) private tokenDetails;
    
    // Mock response codes
    int64 private mockedCreateTokenResponseCode;
    address private mockedCreateTokenAddress;
    
    // Mock events
    event TokenCreated(address tokenAddress, int64 responseCode);
    event TokenMinted(address token, uint256 amount, int64 responseCode);
    event TokenTransferred(address token, address from, address to, uint256 amount, int64 responseCode);
    event TokenAssociated(address token, address account, int64 responseCode);
    
    constructor() {
        // Initialize with success response
        mockedCreateTokenResponseCode = 0;
        mockedCreateTokenAddress = address(0);
    }
    
    /**
     * @dev Set up test tokens
     */
    function setupTokens(
        address tokenAddress,
        address sauceTokenAddress,
        address clxyTokenAddress,
        address userAddress
    ) external override {
        // Associate tokens with this contract
        tokenAssociations[tokenAddress][address(this)] = true;
        tokenAssociations[sauceTokenAddress][address(this)] = true;
        tokenAssociations[clxyTokenAddress][address(this)] = true;
        
        // Associate tokens with user
        tokenAssociations[tokenAddress][userAddress] = true;
        tokenAssociations[sauceTokenAddress][userAddress] = true;
        tokenAssociations[clxyTokenAddress][userAddress] = true;
    }
    
    /**
     * @dev Set supply key holder for a token
     */
    function setSupplyKeyHolder(address token, address holder) external {
        supplyKeys[holder] = true;
    }
    
    /**
     * @dev Set the mocked create token response
     */
    function setMockedCreateTokenResponse(int64 responseCode, address tokenAddress) external override {
        mockedCreateTokenResponseCode = responseCode;
        mockedCreateTokenAddress = tokenAddress;
    }
    
    /**
     * @dev Create a new token
     */
    function createToken(
        HederaToken memory token,
        uint256 initialTotalSupply,
        uint8[] memory keys,
        address[] memory keyAddresses
    ) external payable override returns (int64 responseCode, address tokenAddress) {
        // Return mocked response if set
        if (mockedCreateTokenResponseCode != 0) {
            emit TokenCreated(mockedCreateTokenAddress, mockedCreateTokenResponseCode);
            return (mockedCreateTokenResponseCode, mockedCreateTokenAddress);
        }
        
        // Generate a deterministic address if none set
        tokenAddress = mockedCreateTokenAddress == address(0) 
            ? address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender)))))
            : mockedCreateTokenAddress;
            
        // Store token details
        tokenDetails[tokenAddress] = token;
        
        // Associate token with treasury
        tokenAssociations[tokenAddress][token.treasury] = true;
        emit TokenAssociated(tokenAddress, token.treasury, 0);
        
        // Set initial balance
        if (initialTotalSupply > 0) {
            tokenBalances[token.treasury] = initialTotalSupply;
            emit TokenMinted(tokenAddress, initialTotalSupply, 0);
        }
        
        // Store keys
        for (uint i = 0; i < keys.length; i++) {
            if (keys[i] == 4) { // Supply key type
                supplyKeys[keyAddresses[i]] = true;
            }
        }
        
        // Associate token with this contract
        tokenAssociations[tokenAddress][address(this)] = true;
        emit TokenAssociated(tokenAddress, address(this), 0);
        
        // Associate token with the controller
        tokenAssociations[tokenAddress][msg.sender] = true;
        emit TokenAssociated(tokenAddress, msg.sender, 0);
        
        emit TokenCreated(tokenAddress, 0);
        return (0, tokenAddress);
    }
    
    /**
     * @dev Check if an account has the supply key for a token
     */
    function isSupplyKey(address token, address account) external view override returns (bool) {
        return supplyKeys[account];
    }
    
    /**
     * @dev Associate a token with an account
     */
    function associateToken(address account, address token) external override returns (int64) {
        // Check if already associated
        if (tokenAssociations[token][account]) {
            return -1; // Already associated
        }
        
        tokenAssociations[token][account] = true;
        emit TokenAssociated(token, account, 0);
        return 0; // Success
    }
    
    /**
     * @dev Disassociate a token from an account
     */
    function disassociateToken(address account, address token) external override returns (int64) {
        tokenAssociations[token][account] = false;
        return 0; // Success
    }
    
    /**
     * @dev Mint tokens
     */
    function mintToken(address token, uint256 amount, bytes[] memory) external override returns (int64) {
        tokenBalances[msg.sender] += amount;
        emit TokenMinted(token, amount, 0);
        return 0; // Success
    }
    
    /**
     * @dev Burn tokens
     */
    function burnToken(address token, uint256 amount, bytes[] memory) external override returns (int64) {
        if (tokenBalances[msg.sender] < amount) {
            return -1; // Insufficient balance
        }
        tokenBalances[msg.sender] -= amount;
        return 0; // Success
    }
    
    /**
     * @dev Get token allowance
     */
    function allowance(address token, address owner, address spender) external view override returns (uint256) {
        return allowances[token][owner][spender];
    }
    
    /**
     * @dev Get token balance
     */
    function balanceOf(address token, address account) external view override returns (uint256) {
        return tokenBalances[account];
    }
    
    /**
     * @dev Transfer tokens
     */
    function transferToken(address token, address sender, address recipient, uint256 amount) external override returns (int64) {
        int64 result = transferResults[token];
        if (result != 0) {
            return result;
        }
        
        if (tokenBalances[sender] < amount) {
            return -1; // Insufficient balance
        }
        
        tokenBalances[sender] -= amount;
        tokenBalances[recipient] += amount;
        
        emit TokenTransferred(token, sender, recipient, amount, 0);
        return 0; // Success
    }
    
    /**
     * @dev Check if a token is associated with an account
     */
    function isTokenAssociated(address token, address account) external view override returns (bool) {
        return tokenAssociations[token][account];
    }
    
    /**
     * @dev Set token association status (for testing)
     */
    function setTokenAssociation(address token, address account, bool isAssociated) external {
        tokenAssociations[token][account] = isAssociated;
    }
    
    /**
     * @dev Set token balance (for testing)
     */
    function setBalance(address token, address account, uint256 balance) external override {
        tokenBalances[account] = balance;
    }
    
    /**
     * @dev Set token allowance (for testing)
     */
    function setAllowance(address token, address owner, address spender, uint256 amount) external override {
        allowances[token][owner][spender] = amount;
    }
    
    /**
     * @dev Set transfer result (for testing)
     */
    function setTransferResult(address token, int64 result) external override {
        transferResults[token] = result;
    }
    
    /**
     * @dev Clear transfer results (for testing)
     */
    function clearTransferResults() external override {
        // Clear all transfer results
        for (uint i = 0; i < 100; i++) { // Arbitrary limit to prevent gas issues
            address token = address(uint160(i));
            delete transferResults[token];
        }
    }
    
    /**
     * @dev Get token details
     */
    function getTokenInfo(address tokenAddress) external view returns (HederaToken memory) {
        return tokenDetails[tokenAddress];
    }
} 