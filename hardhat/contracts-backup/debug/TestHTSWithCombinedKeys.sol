// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../index-token/interfaces/IHederaTokenService.sol";

/**
 * @title TestHTSWithCombinedKeys
 * @dev Test contract that exactly mimics the main controller's token creation pattern
 */
contract TestHTSWithCombinedKeys {
    address public constant HTS_PRECOMPILE = 0x0000000000000000000000000000000000000167;
    address public lastCreatedToken;
    address public ADMIN;
    
    // Events for debugging
    event Checkpoint(string step);
    event GasCheckpoint(string step, uint256 gasLeft);
    event TokenCreated(address tokenAddress, int64 responseCode);
    event TokenCreationError(int64 responseCode, string errorMessage);
    
    constructor() {
        ADMIN = msg.sender;
    }
    
    /**
     * @dev Create a token using exactly the same pattern as the main controller
     */
    function createExactControllerCopy(
        string calldata name, 
        string calldata symbol, 
        string calldata memo,
        address treasury
    ) external payable {
        emit Checkpoint("Start ExactCopy");
        emit GasCheckpoint("Start ExactCopy", gasleft());
        
        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
        
        // Create token key arrays - copied from main controller
        address[] memory adminKey = new address[](1);
        adminKey[0] = ADMIN;
        
        address[] memory supplyKey = new address[](1);
        supplyKey[0] = address(this);
        
        address[] memory emptyKeys = new address[](0);
        
        emit Checkpoint("Before creating token struct");
        emit GasCheckpoint("Before creating token struct", gasleft());
        
        // Create token structure - copied from main controller
        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken({
            name: name,
            symbol: symbol,
            treasury: treasury,
            memo: memo,
            supplyType: true,
            maxSupply: 0,
            freezeDefault: false,
            freezeKey: emptyKeys,
            wipeKey: emptyKeys,
            supplyKey: supplyKey,
            adminKey: adminKey,
            kycKey: emptyKeys,
            decimals: 8,
            autoRenewAccount: address(this),
            autoRenewPeriod: 7000000
        });
        
        emit Checkpoint("After creating token struct");
        emit GasCheckpoint("After creating token struct", gasleft());
        
        // Create key types and addresses arrays - copied from main controller
        uint8[] memory keys = new uint8[](3);
        keys[0] = 1; // Admin key
        keys[1] = 4; // Supply key
        keys[2] = 8; // Auto-renew key
        
        address[] memory keyAddresses = new address[](3);
        keyAddresses[0] = ADMIN;
        keyAddresses[1] = address(this);
        keyAddresses[2] = address(this);
        
        emit Checkpoint("Before calling createToken");
        emit GasCheckpoint("Before calling createToken", gasleft());
        
        // Create token with value for fees
        int64 responseCode;
        address tokenAddress;
        
        try hts.createToken{value: msg.value}(token, 0, keys, keyAddresses) returns (int64 code, address addr) {
            responseCode = code;
            tokenAddress = addr;
            emit Checkpoint("After calling createToken");
            emit GasCheckpoint("After calling createToken", gasleft());
        } catch (bytes memory errorData) {
            emit Checkpoint("Error in createToken");
            emit GasCheckpoint("Error in createToken", gasleft());
            
            string memory errorMessage = string(errorData);
            if (errorData.length == 0) {
                errorMessage = "Unknown error (empty revert data)";
            }
            emit TokenCreationError(-999, errorMessage);
            return;
        }
        
        // Check response
        if (responseCode != 0) {
            string memory errorMessage = responseCode == 22 ? "TOKEN_ALREADY_EXISTS_WITH_DIFFERENT_PROPERTIES" :
                                      responseCode == 27 ? "INVALID_TOKEN_TREASURY_ACCOUNT" :
                                      responseCode == 7 ? "INSUFFICIENT_PAYER_BALANCE" :
                                      "Unknown HTS error";
            emit TokenCreationError(responseCode, errorMessage);
            return;
        }
        
        lastCreatedToken = tokenAddress;
        emit TokenCreated(tokenAddress, responseCode);
    }
    
    /**
     * @dev Create token with combined keys but using msg.sender as treasury
     */
    function createControllerPatternSelfTreasury(
        string memory name, 
        string memory symbol, 
        string memory memo
    ) external payable {
        // Call with self (msg.sender) as treasury - inline implementation to avoid compilation issues
        emit Checkpoint("Start SelfTreasury");
        emit GasCheckpoint("Start SelfTreasury", gasleft());
        
        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
        
        // Create token key arrays - copied from main controller
        address[] memory adminKey = new address[](1);
        adminKey[0] = ADMIN;
        
        address[] memory supplyKey = new address[](1);
        supplyKey[0] = address(this);
        
        address[] memory emptyKeys = new address[](0);
        
        emit Checkpoint("Before creating token struct");
        emit GasCheckpoint("Before creating token struct", gasleft());
        
        // Create token structure - copied from main controller
        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken({
            name: name,
            symbol: symbol,
            treasury: msg.sender,
            memo: memo,
            supplyType: true,
            maxSupply: 0,
            freezeDefault: false,
            freezeKey: emptyKeys,
            wipeKey: emptyKeys,
            supplyKey: supplyKey,
            adminKey: adminKey,
            kycKey: emptyKeys,
            decimals: 8,
            autoRenewAccount: address(this),
            autoRenewPeriod: 7000000
        });
        
        emit Checkpoint("After creating token struct");
        emit GasCheckpoint("After creating token struct", gasleft());
        
        // Create key types and addresses arrays - copied from main controller
        uint8[] memory keys = new uint8[](3);
        keys[0] = 1; // Admin key
        keys[1] = 4; // Supply key
        keys[2] = 8; // Auto-renew key
        
        address[] memory keyAddresses = new address[](3);
        keyAddresses[0] = ADMIN;
        keyAddresses[1] = address(this);
        keyAddresses[2] = address(this);
        
        emit Checkpoint("Before calling createToken");
        emit GasCheckpoint("Before calling createToken", gasleft());
        
        // Create token with value for fees
        int64 responseCode;
        address tokenAddress;
        
        try hts.createToken{value: msg.value}(token, 0, keys, keyAddresses) returns (int64 code, address addr) {
            responseCode = code;
            tokenAddress = addr;
            emit Checkpoint("After calling createToken");
            emit GasCheckpoint("After calling createToken", gasleft());
        } catch (bytes memory errorData) {
            emit Checkpoint("Error in createToken");
            emit GasCheckpoint("Error in createToken", gasleft());
            
            string memory errorMessage = string(errorData);
            if (errorData.length == 0) {
                errorMessage = "Unknown error (empty revert data)";
            }
            emit TokenCreationError(-999, errorMessage);
            return;
        }
        
        // Check response
        if (responseCode != 0) {
            string memory errorMessage = responseCode == 22 ? "TOKEN_ALREADY_EXISTS_WITH_DIFFERENT_PROPERTIES" :
                                      responseCode == 27 ? "INVALID_TOKEN_TREASURY_ACCOUNT" :
                                      responseCode == 7 ? "INSUFFICIENT_PAYER_BALANCE" :
                                      "Unknown HTS error";
            emit TokenCreationError(responseCode, errorMessage);
            return;
        }
        
        lastCreatedToken = tokenAddress;
        emit TokenCreated(tokenAddress, responseCode);
    }
    
    // Allow contract to receive HBAR
    receive() external payable {}
}