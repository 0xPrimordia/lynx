// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "./interfaces/IHederaTokenService.sol";
import "hardhat/console.sol";

/**
 * @title MockHederaTokenService
 * @dev Comprehensive mock implementation of the Hedera Token Service for testing
 * This contract implements all the required functionality to test the LynxMinter contract
 */
contract MockHederaTokenService is IHederaTokenService {
    // Storage for token balances
    mapping(address => mapping(address => uint256)) private tokenBalances;
    
    // Storage for token allowances
    mapping(address => mapping(address => mapping(address => uint256))) private tokenAllowances;
    
    // Track token associations
    mapping(address => mapping(address => bool)) private tokenAssociations;
    
    // Track which tokens have minting enabled
    mapping(address => bool) private mintingEnabled;
    
    // Track supply key holders for each token
    mapping(address => address) private tokenSupplyKeyHolders;

    // Track transfer results for testing
    mapping(address => int64) private transferResults;

    // Track token transfers
    struct Transfer {
        address from;
        address to;
        uint256 amount;
    }
    mapping(address => Transfer[]) private tokenTransfers;
    string[] private recordedCalls;
    
    // Mock HTS precompile address for testing
    address private mockHtsPrecompile;
    
    // Variables for mocking responses
    int64 private mockedCreateTokenResponseCode;
    address private mockedCreateTokenAddress;
    mapping(address => mapping(address => bool)) private mockedIsSupplyKeyResults;
    
    // Special flag for testing purposes to skip token allowance checks
    bool private skipAllowanceChecks = false;

    // Add new state variables for testing
    mapping(address => bool) private transferFailures;
    mapping(address => bool) private mintFailures;

    // Events
    event TokenMinted(address indexed token, uint256 amount);
    event TokenBurned(address indexed token, uint256 amount);
    event TokenTransferred(address indexed token, address indexed from, address indexed to, uint256 amount);
    event TokenAssociated(address indexed account, address indexed token);
    event TokenCreated(address indexed token, string name, string symbol, address treasury);

    // Custom errors
    error InsufficientTokenAllowance(address token, uint256 allowance, uint256 required);
    error NoSupplyKeyPermission(address token, address caller);

    constructor() {
        // Initialize test tokens with minting enabled
        mintingEnabled[0x0000000000000000000000000000000000000001] = true; // LYNX
        mintingEnabled[0x0000000000000000000000000000000000000002] = true; // SAUCE
        mintingEnabled[0x0000000000000000000000000000000000000003] = true; // CLXY
        
        // Set default supply key holders (none by default)
        tokenSupplyKeyHolders[0x0000000000000000000000000000000000000001] = address(0);
        tokenSupplyKeyHolders[0x0000000000000000000000000000000000000002] = address(0);
        tokenSupplyKeyHolders[0x0000000000000000000000000000000000000003] = address(0);

        // Associate tokens with this contract
        tokenAssociations[address(this)][0x0000000000000000000000000000000000000001] = true;
        tokenAssociations[address(this)][0x0000000000000000000000000000000000000002] = true;
        tokenAssociations[address(this)][0x0000000000000000000000000000000000000003] = true;
    }

    /**
     * @dev Set the mock HTS precompile address
     * @param _mockHtsPrecompile The address to use as the mock HTS precompile
     */
    function setMockHtsPrecompile(address _mockHtsPrecompile) external {
        mockHtsPrecompile = _mockHtsPrecompile;
    }

    /**
     * @dev Get the mock HTS precompile address
     * @return The mock HTS precompile address
     */
    function getMockHtsPrecompile() external view returns (address) {
        return mockHtsPrecompile;
    }

    /**
     * @dev Associate a token with an account
     * @param account The account to associate the token with
     * @param token The token to associate
     * @return A response code (0 = success)
     */
    function associateToken(address account, address token) external override returns (int64) {
        tokenAssociations[account][token] = true;
        emit TokenAssociated(account, token);
        return 0;
    }

    /**
     * @dev Disassociate a token from an account
     * @param account The account to disassociate the token from
     * @param token The token to disassociate
     * @return A response code (0 = success)
     */
    function disassociateToken(address account, address token) external override returns (int64) {
        tokenAssociations[account][token] = false;
        return 0;
    }

    /**
     * @dev Set a token as associated with an account (test helper)
     */
    function setTokenAssociated(address account, address token, bool associated) public {
        tokenAssociations[account][token] = associated;
    }

    /**
     * @dev Transfer tokens from one account to another
     * @param token The token to transfer
     * @param from The account to transfer from
     * @param to The account to transfer to
     * @param amount The amount to transfer
     * @return A response code (0 = success)
     */
    function transferToken(
        address token,
        address from,
        address to,
        uint256 amount
    ) external override returns (int64) {
        // Check if a specific transfer result is set
        if (transferResults[token] != 0) {
            return transferResults[token];
        }

        // Normal transfer logic
        if (!tokenAssociations[from][token] || !tokenAssociations[to][token]) {
            return -1; // Token not associated
        }

        if (tokenBalances[token][from] < amount) {
            return -2; // Insufficient balance
        }

        if (msg.sender != from && tokenAllowances[token][from][msg.sender] < amount) {
            return -3; // Insufficient allowance
        }

        tokenBalances[token][from] -= amount;
        tokenBalances[token][to] += amount;

        if (msg.sender != from) {
            tokenAllowances[token][from][msg.sender] -= amount;
        }

        return 0;
    }

    /**
     * @dev Get the last transfer for a token
     * @param token The token to get the last transfer for
     * @return The last transfer (from, to, amount)
     */
    function getLastTransfer(address token) external view returns (Transfer memory) {
        require(tokenTransfers[token].length > 0, "No transfers recorded");
        return tokenTransfers[token][tokenTransfers[token].length - 1];
    }

    /**
     * @dev Get all recorded calls
     * @return Array of recorded calls
     */
    function getRecordedCalls() external view returns (string[] memory) {
        return recordedCalls;
    }

    /**
     * @dev Mint new tokens
     * @param token The token to mint
     * @param amount The amount to mint
     * @return A response code (0 = success)
     */
    function mintToken(address token, uint256 amount, bytes[] memory) external override returns (int64) {
        // Check for mint failure
        if (mintFailures[token]) {
            return -4; // Custom error code for mint failure
        }

        // Check if minting is enabled for this token
        require(mintingEnabled[token], "Minting not enabled for this token");
        
        // Check if caller has the supply key for the token
        address supplyKeyHolder = tokenSupplyKeyHolders[token];
        if (supplyKeyHolder != address(0) && msg.sender != supplyKeyHolder) {
            revert NoSupplyKeyPermission(token, msg.sender);
        }
        
        // In Hedera, when a contract mints tokens, they are added to the contract's balance
        tokenBalances[token][msg.sender] += amount;
        emit TokenMinted(token, amount);
        return 0;
    }

    /**
     * @dev Burn tokens
     * @param token The token to burn
     * @param amount The amount to burn
     * @return A response code (0 = success)
     */
    function burnToken(address token, uint256 amount, bytes[] memory) external override returns (int64) {
        // Check if caller has the supply key for the token
        address supplyKeyHolder = tokenSupplyKeyHolders[token];
        if (supplyKeyHolder != address(0) && msg.sender != supplyKeyHolder) {
            revert NoSupplyKeyPermission(token, msg.sender);
        }
        
        require(tokenBalances[token][msg.sender] >= amount, "Insufficient balance to burn");
        tokenBalances[token][msg.sender] -= amount;
        emit TokenBurned(token, amount);
        return 0;
    }

    /**
     * @dev Get the allowance of tokens that a spender can use from an owner
     * @param token The token to check allowance for
     * @param owner The owner of the tokens
     * @param spender The spender who can use the tokens
     * @return The amount of tokens the spender can use
     */
    function allowance(address token, address owner, address spender) external view override returns (uint256) {
        return tokenAllowances[token][owner][spender];
    }

    /**
     * @dev Get the balance of tokens for an account
     * @param token The token to check the balance of
     * @param account The account to check the balance for
     * @return The balance of tokens
     */
    function balanceOf(address token, address account) external view override returns (uint256) {
        return tokenBalances[token][account];
    }
    
    /**
     * @dev Create a new token
     * @param token The token configuration
     * @param initialTotalSupply The initial supply to mint
     * @param keys The key types to set
     * @param keyAddresses The addresses for each key
     * @return responseCode A response code (0 = success)
     * @return tokenAddress The address of the created token
     */
    function createToken(
        IHederaTokenService.HederaToken memory token,
        uint initialTotalSupply,
        uint8[] memory keys,
        address[] memory keyAddresses
    ) external payable override returns (int64 responseCode, address tokenAddress) {
        // If a mocked response is set, use it
        if (mockedCreateTokenAddress != address(0)) {
            tokenAddress = mockedCreateTokenAddress;
            responseCode = mockedCreateTokenResponseCode;
            
            // Reset mocked values
            mockedCreateTokenAddress = address(0);
            mockedCreateTokenResponseCode = 0;
            
            // Enable minting for this token
            mintingEnabled[tokenAddress] = true;
            
            // Set the treasury
            if (initialTotalSupply > 0) {
                tokenBalances[tokenAddress][token.treasury] = initialTotalSupply;
            }
            
            // Associate the token with the treasury
            tokenAssociations[token.treasury][tokenAddress] = true;
            
            // Process keys
            for (uint i = 0; i < keys.length; i++) {
                if (keys[i] == 4) { // Supply key
                    tokenSupplyKeyHolders[tokenAddress] = keyAddresses[i];
                }
            }
            
            emit TokenCreated(tokenAddress, token.name, token.symbol, token.treasury);
            return (responseCode, tokenAddress);
        }
        
        // Generate a new token address - use a simple approach for mock
        tokenAddress = address(uint160(uint256(keccak256(abi.encodePacked(block.timestamp, msg.sender, token.name)))));
        
        // Enable minting for this token
        mintingEnabled[tokenAddress] = true;
        
        // Set the treasury
        if (initialTotalSupply > 0) {
            tokenBalances[tokenAddress][token.treasury] = initialTotalSupply;
        }
        
        // Associate the token with the treasury
        tokenAssociations[token.treasury][tokenAddress] = true;
        
        // Process keys
        for (uint i = 0; i < keys.length; i++) {
            if (keys[i] == 4) { // Supply key
                tokenSupplyKeyHolders[tokenAddress] = keyAddresses[i];
            }
        }
        
        emit TokenCreated(tokenAddress, token.name, token.symbol, token.treasury);
        return (0, tokenAddress);
    }
    
    /**
     * @dev Check if an address has the supply key for a token
     * @param token The token to check
     * @param supplyAddress The address to check
     * @return True if the address has the supply key
     */
    function isSupplyKey(address token, address supplyAddress) external view override returns (bool) {
        // Return a specific mocked value if set
        if (mockedIsSupplyKeyResults[token][supplyAddress]) {
            return true;
        }
        
        // Otherwise use the default supply key holder value
        return tokenSupplyKeyHolders[token] == supplyAddress;
    }

    // Test helper functions - not part of the real HTS interface

    /**
     * @dev Set the allowance of tokens for a spender (test helper)
     */
    function setAllowance(address token, address owner, address spender, uint256 amount) external {
        tokenAllowances[token][owner][spender] = amount;
    }

    /**
     * @dev Check if a token is associated with an account
     * @param token The token to check
     * @param account The account to check
     * @return Whether the token is associated with the account
     */
    function isTokenAssociated(address token, address account) external view returns (bool) {
        return tokenAssociations[account][token];
    }

    /**
     * @dev Set whether minting is enabled for a token (test helper)
     */
    function setMintingEnabled(address token, bool enabled) external {
        mintingEnabled[token] = enabled;
    }
    
    /**
     * @dev Set the supply key holder for a token (test helper)
     * @param token The token to set the supply key holder for
     * @param supplyKeyHolder The address to set as the supply key holder
     */
    function setSupplyKeyHolder(address token, address supplyKeyHolder) external {
        tokenSupplyKeyHolders[token] = supplyKeyHolder;
    }
    
    /**
     * @dev Get the supply key holder for a token (test helper)
     */
    function getSupplyKeyHolder(address token) external view returns (address) {
        return tokenSupplyKeyHolders[token];
    }

    /**
     * @dev Mock the response for createToken (test helper)
     */
    function mockCreateTokenResponse(int64 responseCode, address tokenAddress) external {
        mockedCreateTokenResponseCode = responseCode;
        mockedCreateTokenAddress = tokenAddress;
    }
    
    /**
     * @dev Mock the response for isSupplyKey (test helper)
     */
    function mockIsSupplyKey(address token, address supplyAddress, bool result) external {
        mockedIsSupplyKeyResults[token][supplyAddress] = result;
    }

    /**
     * @dev Set whether to skip allowance checks
     * @param skip Whether to skip allowance checks
     */
    function setSkipAllowanceChecks(bool skip) external {
        skipAllowanceChecks = skip;
    }

    /**
     * @dev Get whether allowance checks are being skipped
     * @return Whether allowance checks are being skipped
     */
    function getSkipAllowanceChecks() external view returns (bool) {
        return skipAllowanceChecks;
    }

    /**
     * @dev Setup test tokens with initial configurations
     * @param lynxToken The LYNX token address
     * @param sauceToken The SAUCE token address
     * @param clxyToken The CLXY token address
     * @param lynxMinter The LynxMinter contract address
     */
    function setupTokens(
        address lynxToken,
        address sauceToken,
        address clxyToken,
        address lynxMinter
    ) external {
        // Enable minting for all tokens
        mintingEnabled[lynxToken] = true;
        mintingEnabled[sauceToken] = true;
        mintingEnabled[clxyToken] = true;

        // Associate tokens with the LynxMinter contract
        tokenAssociations[lynxMinter][lynxToken] = true;
        tokenAssociations[lynxMinter][sauceToken] = true;
        tokenAssociations[lynxMinter][clxyToken] = true;

        // Set the LynxMinter as the supply key holder for LYNX token
        tokenSupplyKeyHolders[lynxToken] = lynxMinter;
        
        // Initialize balances and allowances for the LynxMinter
        // Note: We don't need to initialize the nested mappings as they default to 0
        // Just set the initial values directly
        tokenBalances[lynxToken][lynxMinter] = 0;
        tokenBalances[sauceToken][lynxMinter] = 0;
        tokenBalances[clxyToken][lynxMinter] = 0;
        
        tokenAllowances[lynxToken][lynxMinter][address(0)] = 0;
        tokenAllowances[sauceToken][lynxMinter][address(0)] = 0;
        tokenAllowances[clxyToken][lynxMinter][address(0)] = 0;
    }

    /**
     * @dev Convert uint to string
     * @param _i The uint to convert
     * @return The string representation
     */
    function uint2str(uint _i) internal pure returns (string memory) {
        if (_i == 0) return "0";
        uint j = _i;
        uint len;
        while (j != 0) {
            len++;
            j /= 10;
        }
        bytes memory bstr = new bytes(len);
        uint k = len;
        while (_i != 0) {
            k = k-1;
            uint8 temp = (48 + uint8(_i - _i / 10 * 10));
            bytes1 b1 = bytes1(temp);
            bstr[k] = b1;
            _i /= 10;
        }
        return string(bstr);
    }

    /**
     * @dev Convert address to hex string
     * @param addr The address to convert
     * @return The hex string representation
     */
    function toHexString(address addr) internal pure returns (string memory) {
        bytes memory buffer = new bytes(40);
        for(uint256 i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint256(uint160(addr)) / (2**(8*(19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            buffer[2*i] = char(hi);
            buffer[2*i+1] = char(lo);            
        }
        return string(abi.encodePacked("0x", buffer));
    }

    function char(bytes1 b) internal pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }

    /**
     * @dev Set transfer failure for a token
     * @param token The token to set transfer failure for
     * @param shouldFail Whether transfers should fail
     */
    function setTransferFailure(address token, bool shouldFail) external {
        transferFailures[token] = shouldFail;
    }

    /**
     * @dev Set mint failure for a token
     * @param token The token to set mint failure for
     * @param shouldFail Whether mints should fail
     */
    function setMintFailure(address token, bool shouldFail) external {
        mintFailures[token] = shouldFail;
    }

    /**
     * @dev Revoke token association
     * @param token The token to revoke association for
     * @param account The account to revoke association from
     */
    function revokeTokenAssociation(address token, address account) external {
        tokenAssociations[account][token] = false;
    }

    /**
     * @dev Set token balance for testing
     * @param token The token to set balance for
     * @param account The account to set balance for
     * @param amount The amount to set
     */
    function setBalance(address token, address account, uint256 amount) external {
        tokenBalances[token][account] = amount;
    }

    /**
     * @dev Set a specific transfer result for testing
     * @param token The token to set the result for
     * @param result The result to return (-1 = not associated, -2 = insufficient balance, -3 = insufficient allowance)
     */
    function setTransferResult(address token, int64 result) external {
        transferResults[token] = result;
    }

    /**
     * @dev Clear all transfer results (for testing)
     */
    function clearTransferResults() external {
        delete transferResults[0x0000000000000000000000000000000000000001];
        delete transferResults[0x0000000000000000000000000000000000000002];
        delete transferResults[0x0000000000000000000000000000000000000003];
    }

    receive() external payable {}
} 