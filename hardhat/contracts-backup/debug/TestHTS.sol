// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import "../index-token/interfaces/IHederaTokenService.sol";

/**
 * @title TestHTS
 * @dev Minimal contract for testing HTS precompile interactions
 */
contract TestHTS {
    address public constant HTS_PRECOMPILE = 0x0000000000000000000000000000000000000167;
    address public lastCreatedToken;
    
    // Events for debugging
    event Checkpoint(string step);
    event GasCheckpoint(string step, uint256 gasLeft);
    event TokenCreated(address tokenAddress, int64 responseCode);
    event TokenCreationError(int64 responseCode, string errorMessage);
    
    /**
     * @dev Create a basic token with minimal configuration
     */
    function createBasicToken(string memory name, string memory symbol) external payable {
        emit Checkpoint("Start");
        emit GasCheckpoint("Start", gasleft());
        
        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
        
        // Create simplest possible token structure
        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken({
            name: name,
            symbol: symbol,
            treasury: msg.sender, // Use caller as treasury
            memo: "Test Token",
            supplyType: true,
            maxSupply: 0,
            freezeDefault: false,
            freezeKey: new address[](0),
            wipeKey: new address[](0),
            supplyKey: new address[](0),
            adminKey: new address[](0),
            kycKey: new address[](0),
            decimals: 8,
            autoRenewAccount: address(0),
            autoRenewPeriod: 7000000
        });
        
        emit Checkpoint("Before createToken");
        emit GasCheckpoint("Before createToken", gasleft());
        
        try hts.createToken{value: msg.value}(token, 0, new uint8[](0), new address[](0)) returns (int64 code, address addr) {
            emit Checkpoint("After createToken");
            emit GasCheckpoint("After createToken", gasleft());
            
            lastCreatedToken = addr;
            emit TokenCreated(addr, code);
        } catch (bytes memory errorData) {
            emit Checkpoint("Error in createToken");
            emit GasCheckpoint("Error in createToken", gasleft());
            
            string memory errorMessage = string(errorData);
            if (errorData.length == 0) {
                errorMessage = "Unknown error (empty revert data)";
            }
            emit TokenCreationError(-999, errorMessage);
        }
    }
    
    /**
     * @dev Create token with admin key only
     */
    function createTokenWithAdminKey(string memory name, string memory symbol) external payable {
        emit Checkpoint("Start AdminKey");
        emit GasCheckpoint("Start AdminKey", gasleft());
        
        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
        
        // Create admin key array
        address[] memory adminKey = new address[](1);
        adminKey[0] = msg.sender;
        
        // Create empty key arrays
        address[] memory emptyKeys = new address[](0);
        
        // Create token structure
        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken({
            name: name,
            symbol: symbol,
            treasury: msg.sender,
            memo: "Test Token with Admin Key",
            supplyType: true,
            maxSupply: 0,
            freezeDefault: false,
            freezeKey: emptyKeys,
            wipeKey: emptyKeys,
            supplyKey: emptyKeys,
            adminKey: adminKey,
            kycKey: emptyKeys,
            decimals: 8,
            autoRenewAccount: address(0),
            autoRenewPeriod: 7000000
        });
        
        // Create keys array
        uint8[] memory keys = new uint8[](1);
        keys[0] = 1; // Admin key
        
        address[] memory keyAddresses = new address[](1);
        keyAddresses[0] = msg.sender;
        
        emit Checkpoint("Before createToken AdminKey");
        emit GasCheckpoint("Before createToken AdminKey", gasleft());
        
        try hts.createToken{value: msg.value}(token, 0, keys, keyAddresses) returns (int64 code, address addr) {
            emit Checkpoint("After createToken AdminKey");
            emit GasCheckpoint("After createToken AdminKey", gasleft());
            
            lastCreatedToken = addr;
            emit TokenCreated(addr, code);
        } catch (bytes memory errorData) {
            emit Checkpoint("Error in createToken AdminKey");
            emit GasCheckpoint("Error in createToken AdminKey", gasleft());
            
            string memory errorMessage = string(errorData);
            if (errorData.length == 0) {
                errorMessage = "Unknown error (empty revert data)";
            }
            emit TokenCreationError(-999, errorMessage);
        }
    }
    
    /**
     * @dev Create token with admin key and supply key
     */
    function createTokenWithSupplyKey(string memory name, string memory symbol) external payable {
        emit Checkpoint("Start SupplyKey");
        emit GasCheckpoint("Start SupplyKey", gasleft());
        
        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
        
        // Create key arrays
        address[] memory adminKey = new address[](1);
        adminKey[0] = msg.sender;
        
        address[] memory supplyKey = new address[](1);
        supplyKey[0] = address(this);
        
        address[] memory emptyKeys = new address[](0);
        
        // Create token structure
        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken({
            name: name,
            symbol: symbol,
            treasury: msg.sender,
            memo: "Test Token with Admin and Supply Keys",
            supplyType: true,
            maxSupply: 0,
            freezeDefault: false,
            freezeKey: emptyKeys,
            wipeKey: emptyKeys,
            supplyKey: supplyKey,
            adminKey: adminKey,
            kycKey: emptyKeys,
            decimals: 8,
            autoRenewAccount: address(0),
            autoRenewPeriod: 7000000
        });
        
        // Create key types array
        uint8[] memory keys = new uint8[](2);
        keys[0] = 1; // Admin key
        keys[1] = 4; // Supply key
        
        address[] memory keyAddresses = new address[](2);
        keyAddresses[0] = msg.sender;
        keyAddresses[1] = address(this);
        
        emit Checkpoint("Before createToken SupplyKey");
        emit GasCheckpoint("Before createToken SupplyKey", gasleft());
        
        try hts.createToken{value: msg.value}(token, 0, keys, keyAddresses) returns (int64 code, address addr) {
            emit Checkpoint("After createToken SupplyKey");
            emit GasCheckpoint("After createToken SupplyKey", gasleft());
            
            lastCreatedToken = addr;
            emit TokenCreated(addr, code);
        } catch (bytes memory errorData) {
            emit Checkpoint("Error in createToken SupplyKey");
            emit GasCheckpoint("Error in createToken SupplyKey", gasleft());
            
            string memory errorMessage = string(errorData);
            if (errorData.length == 0) {
                errorMessage = "Unknown error (empty revert data)";
            }
            emit TokenCreationError(-999, errorMessage);
        }
    }
    
    /**
     * @dev Create token with auto-renew account
     */
    function createTokenWithAutoRenew(string memory name, string memory symbol) external payable {
        emit Checkpoint("Start AutoRenew");
        emit GasCheckpoint("Start AutoRenew", gasleft());
        
        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
        
        // Create key arrays
        address[] memory adminKey = new address[](1);
        adminKey[0] = msg.sender;
        
        address[] memory emptyKeys = new address[](0);
        
        // Create token structure
        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken({
            name: name,
            symbol: symbol,
            treasury: msg.sender,
            memo: "Test Token with AutoRenew",
            supplyType: true,
            maxSupply: 0,
            freezeDefault: false,
            freezeKey: emptyKeys,
            wipeKey: emptyKeys,
            supplyKey: emptyKeys,
            adminKey: adminKey,
            kycKey: emptyKeys,
            decimals: 8,
            autoRenewAccount: address(this),
            autoRenewPeriod: 7000000
        });
        
        // Create key types array
        uint8[] memory keys = new uint8[](2);
        keys[0] = 1; // Admin key
        keys[1] = 8; // Auto-renew key
        
        address[] memory keyAddresses = new address[](2);
        keyAddresses[0] = msg.sender;
        keyAddresses[1] = address(this);
        
        emit Checkpoint("Before createToken AutoRenew");
        emit GasCheckpoint("Before createToken AutoRenew", gasleft());
        
        try hts.createToken{value: msg.value}(token, 0, keys, keyAddresses) returns (int64 code, address addr) {
            emit Checkpoint("After createToken AutoRenew");
            emit GasCheckpoint("After createToken AutoRenew", gasleft());
            
            lastCreatedToken = addr;
            emit TokenCreated(addr, code);
        } catch (bytes memory errorData) {
            emit Checkpoint("Error in createToken AutoRenew");
            emit GasCheckpoint("Error in createToken AutoRenew", gasleft());
            
            string memory errorMessage = string(errorData);
            if (errorData.length == 0) {
                errorMessage = "Unknown error (empty revert data)";
            }
            emit TokenCreationError(-999, errorMessage);
        }
    }
    
    /**
     * @dev Create token using vault as treasury 
     */
    function createTokenWithTreasury(string memory name, string memory symbol, address treasury) external payable {
        emit Checkpoint("Start Treasury");
        emit GasCheckpoint("Start Treasury", gasleft());
        
        IHederaTokenService hts = IHederaTokenService(HTS_PRECOMPILE);
        
        // Create empty key arrays
        address[] memory emptyKeys = new address[](0);
        
        // Create token structure
        IHederaTokenService.HederaToken memory token = IHederaTokenService.HederaToken({
            name: name,
            symbol: symbol,
            treasury: treasury,
            memo: "Test Token with Vault Treasury",
            supplyType: true,
            maxSupply: 0,
            freezeDefault: false,
            freezeKey: emptyKeys,
            wipeKey: emptyKeys,
            supplyKey: emptyKeys,
            adminKey: emptyKeys,
            kycKey: emptyKeys,
            decimals: 8,
            autoRenewAccount: address(0),
            autoRenewPeriod: 7000000
        });
        
        emit Checkpoint("Before createToken Treasury");
        emit GasCheckpoint("Before createToken Treasury", gasleft());
        
        try hts.createToken{value: msg.value}(token, 0, new uint8[](0), new address[](0)) returns (int64 code, address addr) {
            emit Checkpoint("After createToken Treasury");
            emit GasCheckpoint("After createToken Treasury", gasleft());
            
            lastCreatedToken = addr;
            emit TokenCreated(addr, code);
        } catch (bytes memory errorData) {
            emit Checkpoint("Error in createToken Treasury");
            emit GasCheckpoint("Error in createToken Treasury", gasleft());
            
            string memory errorMessage = string(errorData);
            if (errorData.length == 0) {
                errorMessage = "Unknown error (empty revert data)";
            }
            emit TokenCreationError(-999, errorMessage);
        }
    }
    
    // Allow contract to receive HBAR
    receive() external payable {}
} 