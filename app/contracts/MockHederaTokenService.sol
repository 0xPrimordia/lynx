// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./IHederaTokenService.sol";

/**
 * @title MockHederaTokenService
 * @dev Mock implementation of the Hedera Token Service for testing
 * Only implements essential functions needed for testing
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
        mockedCreateTokenResponseCode = 22; // SUCCESS
        mockedCreateTokenAddress = address(0);
    }
    
    // Test helper functions (not part of interface)
    function setupTokens(
        address tokenAddress,
        address sauceTokenAddress,
        address clxyTokenAddress,
        address userAddress
    ) external {
        // Associate tokens with this contract
        tokenAssociations[tokenAddress][address(this)] = true;
        tokenAssociations[sauceTokenAddress][address(this)] = true;
        tokenAssociations[clxyTokenAddress][address(this)] = true;
        
        // Associate tokens with user
        tokenAssociations[tokenAddress][userAddress] = true;
        tokenAssociations[sauceTokenAddress][userAddress] = true;
        tokenAssociations[clxyTokenAddress][userAddress] = true;
    }
    
    function setMockedCreateTokenResponse(int64 responseCode, address tokenAddress) external {
        mockedCreateTokenResponseCode = responseCode;
        mockedCreateTokenAddress = tokenAddress;
    }
    
    function setTokenAssociation(address token, address account, bool isAssociated) external {
        tokenAssociations[token][account] = isAssociated;
    }
    
    function setSupplyKeyHolder(address token, address holder) external {
        supplyKeys[holder] = true;
    }

    // Essential HTS interface implementations
    
    function associateToken(address account, address token) external returns (int64 responseCode) {
        if (tokenAssociations[token][account]) {
            return 173; // TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT
        }
        
        tokenAssociations[token][account] = true;
        emit TokenAssociated(token, account, 22);
        return 22; // SUCCESS
    }
    
    function associateTokens(address account, address[] memory tokens) external returns (int64 responseCode) {
        for (uint i = 0; i < tokens.length; i++) {
            tokenAssociations[tokens[i]][account] = true;
            emit TokenAssociated(tokens[i], account, 22);
        }
        return 22; // SUCCESS
    }
    
    function dissociateToken(address account, address token) external returns (int64 responseCode) {
        tokenAssociations[token][account] = false;
        return 22; // SUCCESS
    }
    
    function dissociateTokens(address account, address[] memory tokens) external returns (int64 responseCode) {
        for (uint i = 0; i < tokens.length; i++) {
            tokenAssociations[tokens[i]][account] = false;
        }
        return 22; // SUCCESS
    }
    
    function mintToken(
        address token,
        int64 amount,
        bytes[] memory metadata
    ) external returns (
        int64 responseCode,
        int64 newTotalSupply,
        int64[] memory serialNumbers
    ) {
        tokenBalances[msg.sender] += uint256(uint64(amount));
        emit TokenMinted(token, uint256(uint64(amount)), 22);
        return (22, amount, new int64[](0)); // SUCCESS
    }
    
    function burnToken(
        address token,
        int64 amount,
        int64[] memory serialNumbers
    ) external returns (int64 responseCode, int64 newTotalSupply) {
        uint256 burnAmount = uint256(uint64(amount));
        if (tokenBalances[msg.sender] < burnAmount) {
            return (13, 0); // INSUFFICIENT_TOKEN_BALANCE
        }
        tokenBalances[msg.sender] -= burnAmount;
        return (22, amount); // SUCCESS
    }
    
    function createFungibleToken(
        HederaToken memory token,
        int64 initialTotalSupply,
        int32 decimals
    ) external payable returns (int64 responseCode, address tokenAddress) {
        // Return mocked response if set
        if (mockedCreateTokenResponseCode != 22) {
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
        emit TokenAssociated(tokenAddress, token.treasury, 22);
        
        // Set initial balance
        if (initialTotalSupply > 0) {
            tokenBalances[token.treasury] = uint256(uint64(initialTotalSupply));
            emit TokenMinted(tokenAddress, uint256(uint64(initialTotalSupply)), 22);
        }
        
        emit TokenCreated(tokenAddress, 22);
        return (22, tokenAddress); // SUCCESS
    }
    
    function isToken(address token) external returns (int64 responseCode, bool isTokenFlag) {
        // Mock: return true if we have token details stored
        return (22, tokenDetails[token].treasury != address(0));
    }
    
    function allowance(
        address token,
        address owner,
        address spender
    ) external returns (int64 responseCode, uint256 allowanceAmount) {
        return (22, allowances[token][owner][spender]);
    }
    
    function transferToken(
        address token,
        address sender,
        address recipient,
        int64 amount
    ) external returns (int64 responseCode) {
        int64 result = transferResults[token];
        if (result != 0) {
            return result;
        }
        
        uint256 transferAmount = uint256(uint64(amount));
        if (tokenBalances[sender] < transferAmount) {
            return 13; // INSUFFICIENT_TOKEN_BALANCE
        }
        
        tokenBalances[sender] -= transferAmount;
        tokenBalances[recipient] += transferAmount;
        
        emit TokenTransferred(token, sender, recipient, transferAmount, 22);
        return 22; // SUCCESS
    }

    // Stub implementations for required interface functions
    function cryptoTransfer(TransferList memory, TokenTransferList[] memory) external returns (int64) { return 22; }
    function createFungibleTokenWithCustomFees(HederaToken memory, int64, int32, FixedFee[] memory, FractionalFee[] memory) external payable returns (int64, address) { return (22, address(0)); }
    function createNonFungibleToken(HederaToken memory) external payable returns (int64, address) { return (22, address(0)); }
    function createNonFungibleTokenWithCustomFees(HederaToken memory, FixedFee[] memory, RoyaltyFee[] memory) external payable returns (int64, address) { return (22, address(0)); }
    function transferTokens(address, address[] memory, int64[] memory) external returns (int64) { return 22; }
    function transferNFTs(address, address[] memory, address[] memory, int64[] memory) external returns (int64) { return 22; }
    function transferNFT(address, address, address, int64) external returns (int64) { return 22; }
    function approve(address, address, uint256) external returns (int64) { return 22; }
    function transferFrom(address, address, address, uint256) external returns (int64) { return 22; }
    function approveNFT(address, address, uint256) external returns (int64) { return 22; }
    function transferFromNFT(address, address, address, uint256) external returns (int64) { return 22; }
    function getApproved(address, uint256) external returns (int64, address) { return (22, address(0)); }
    function setApprovalForAll(address, address, bool) external returns (int64) { return 22; }
    function isApprovedForAll(address, address, address) external returns (int64, bool) { return (22, false); }
    function isFrozen(address, address) external returns (int64, bool) { return (22, false); }
    function isKyc(address, address) external returns (int64, bool) { return (22, true); }
    function deleteToken(address) external returns (int64) { return 22; }
    function getTokenCustomFees(address) external returns (int64, FixedFee[] memory, FractionalFee[] memory, RoyaltyFee[] memory) { return (22, new FixedFee[](0), new FractionalFee[](0), new RoyaltyFee[](0)); }
    function getTokenDefaultFreezeStatus(address) external returns (int64, bool) { return (22, false); }
    function getTokenDefaultKycStatus(address) external returns (int64, bool) { return (22, true); }
    function getTokenExpiryInfo(address) external returns (int64, Expiry memory) { return (22, Expiry(0, address(0), 0)); }
    function getFungibleTokenInfo(address) external returns (int64, FungibleTokenInfo memory) { FungibleTokenInfo memory info; return (22, info); }
    function getTokenInfo(address) external returns (int64, TokenInfo memory) { TokenInfo memory info; return (22, info); }
    function getTokenKey(address, uint) external returns (int64, KeyValue memory) { KeyValue memory key; return (22, key); }
    function getNonFungibleTokenInfo(address, int64) external returns (int64, NonFungibleTokenInfo memory) { NonFungibleTokenInfo memory info; return (22, info); }
    function freezeToken(address, address) external returns (int64) { return 22; }
    function unfreezeToken(address, address) external returns (int64) { return 22; }
    function grantTokenKyc(address, address) external returns (int64) { return 22; }
    function revokeTokenKyc(address, address) external returns (int64) { return 22; }
    function pauseToken(address) external returns (int64) { return 22; }
    function unpauseToken(address) external returns (int64) { return 22; }
    function wipeTokenAccount(address, address, int64) external returns (int64) { return 22; }
    function wipeTokenAccountNFT(address, address, int64[] memory) external returns (int64) { return 22; }
    function updateTokenInfo(address, HederaToken memory) external returns (int64) { return 22; }
    function updateTokenExpiryInfo(address, Expiry memory) external returns (int64) { return 22; }
    function updateTokenKeys(address, TokenKey[] memory) external returns (int64) { return 22; }
    function getTokenType(address) external returns (int64, int32) { return (22, 0); }
    function redirectForToken(address, bytes memory) external returns (int64, bytes memory) { return (22, ""); }
    function updateFungibleTokenCustomFees(address, FixedFee[] memory, FractionalFee[] memory) external returns (int64) { return 22; }
    function updateNonFungibleTokenCustomFees(address, FixedFee[] memory, RoyaltyFee[] memory) external returns (int64) { return 22; }
    function airdropTokens(TokenTransferList[] memory) external returns (int64) { return 22; }
    function cancelAirdrops(PendingAirdrop[] memory) external returns (int64) { return 22; }
    function claimAirdrops(PendingAirdrop[] memory) external returns (int64) { return 22; }
    function rejectTokens(address, address[] memory, NftID[] memory) external returns (int64) { return 22; }
} 