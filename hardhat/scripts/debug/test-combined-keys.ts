import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Testing token creation with combined keys (same as main controller)...");
  
  // Get deployment info
  const debugDeploymentPath = path.join(__dirname, "../../debug-deployment-info.json");
  if (!fs.existsSync(debugDeploymentPath)) {
    console.error("Debug deployment info not found. Please run deploy-test-hts.ts first.");
    return;
  }
  
  const deploymentInfo = JSON.parse(fs.readFileSync(debugDeploymentPath, "utf8"));
  const testHTSAddress = deploymentInfo.testHTSAddress;
  
  console.log("Using TestHTS contract at:", testHTSAddress);
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "HBAR");
  
  // Get TestHTS contract instance
  const testHTS = await ethers.getContractAt("TestHTS", testHTSAddress);
  
  // Now we'll add a function to the contract that mimics the main controller's createIndexToken function
  console.log("Adding new test function to mimic main controller pattern...");
  
  // First, let's get the TestHTS code to update
  const testHTSFactory = await ethers.getContractFactory("TestHTS");
  const testHTSCode = testHTSFactory.interface.encodeFunctionData("createTokenWithAdminKey", ["Dummy", "DMY"]);
  
  console.log("Function signature:", testHTSCode.slice(0, 10));
  
  // Create new contract with additional combined key function
  const combinedKeyCodePath = path.join(__dirname, "../../contracts/debug/TestHTSWithCombinedKeys.sol");
  fs.mkdirSync(path.dirname(combinedKeyCodePath), { recursive: true });
  
  // Create the new contract file
  const contractCode = `// SPDX-License-Identifier: MIT
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
        string calldata name, 
        string calldata symbol, 
        string calldata memo
    ) external payable {
        // Same as createExactControllerCopy but using msg.sender as treasury
        createExactControllerCopy(name, symbol, memo, msg.sender);
    }
    
    // Allow contract to receive HBAR
    receive() external payable {}
}`;

  fs.writeFileSync(combinedKeyCodePath, contractCode);
  console.log("Created TestHTSWithCombinedKeys.sol contract file");
  
  // Now compile and deploy the new contract
  console.log("Compiling the new contract...");
  const combinedKeyFactory = await ethers.getContractFactory("TestHTSWithCombinedKeys");
  const combinedKeyTest = await combinedKeyFactory.deploy({
    gasLimit: 400000,
    gasPrice: ethers.parseUnits("530", "gwei")
  });
  
  console.log("Waiting for deployment...");
  await combinedKeyTest.waitForDeployment();
  
  const combinedKeyAddress = await combinedKeyTest.getAddress();
  console.log("TestHTSWithCombinedKeys deployed to:", combinedKeyAddress);
  
  // Save deployment info
  deploymentInfo.combinedKeyTestAddress = combinedKeyAddress;
  fs.writeFileSync(debugDeploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  // Test the combined key pattern
  console.log("\n===== Testing Controller Pattern with Self Treasury =====");
  try {
    const tx = await combinedKeyTest.createControllerPatternSelfTreasury(
      "Controller Pattern", 
      "CPS", 
      "Testing Controller Pattern with Self Treasury",
      {
        value: ethers.parseEther("10.0"),
        gasLimit: 4000000, // Same limit as main controller
        gasPrice: ethers.parseUnits("530", "gwei")
      }
    );
    
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Extract events from receipt
    console.log("\nEvents from transaction:");
    for (const log of receipt.logs) {
      try {
        const parsedLog = combinedKeyTest.interface.parseLog({
          topics: log.topics,
          data: log.data
        });
        
        if (parsedLog) {
          console.log(`- Event: ${parsedLog.name}`);
          const args = parsedLog.args;
          
          if (parsedLog.name === "GasCheckpoint") {
            console.log(`  Step: ${args.step}, Gas Left: ${args.gasLeft}`);
          } else if (parsedLog.name === "TokenCreated") {
            console.log(`  Token Address: ${args.tokenAddress}, Response Code: ${args.responseCode}`);
          } else if (parsedLog.name === "TokenCreationError") {
            console.log(`  Error Code: ${args.responseCode}, Message: ${args.errorMessage}`);
          } else {
            console.log(`  ${JSON.stringify(args)}`);
          }
        }
      } catch (error) {
        // Not a parsable event
      }
    }
    
    // Check if token was created successfully
    const tokenAddress = await combinedKeyTest.lastCreatedToken();
    if (tokenAddress !== ethers.ZeroAddress) {
      console.log("\nToken created successfully at:", tokenAddress);
    } else {
      console.log("\nToken creation failed - no token address stored");
    }
  } catch (error: any) {
    console.error("\nError creating token:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
  
  // Get deployment info
  const mainDeploymentPath = path.join(__dirname, "../../../deployment-info.json");
  const mainDeploymentInfo = JSON.parse(fs.readFileSync(mainDeploymentPath, "utf8"));
  const vaultAddress = mainDeploymentInfo.vaultEvm;
  
  console.log("\n===== Testing Controller Pattern with Vault Treasury =====");
  try {
    const tx = await combinedKeyTest.createExactControllerCopy(
      "Controller Pattern Vault", 
      "CPV", 
      "Testing Controller Pattern with Vault Treasury",
      vaultAddress,
      {
        value: ethers.parseEther("10.0"),
        gasLimit: 4000000, // Same limit as main controller
        gasPrice: ethers.parseUnits("530", "gwei")
      }
    );
    
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Extract events from receipt
    console.log("\nEvents from transaction:");
    for (const log of receipt.logs) {
      try {
        const parsedLog = combinedKeyTest.interface.parseLog({
          topics: log.topics,
          data: log.data
        });
        
        if (parsedLog) {
          console.log(`- Event: ${parsedLog.name}`);
          const args = parsedLog.args;
          
          if (parsedLog.name === "GasCheckpoint") {
            console.log(`  Step: ${args.step}, Gas Left: ${args.gasLeft}`);
          } else if (parsedLog.name === "TokenCreated") {
            console.log(`  Token Address: ${args.tokenAddress}, Response Code: ${args.responseCode}`);
          } else if (parsedLog.name === "TokenCreationError") {
            console.log(`  Error Code: ${args.responseCode}, Message: ${args.errorMessage}`);
          } else {
            console.log(`  ${JSON.stringify(args)}`);
          }
        }
      } catch (error) {
        // Not a parsable event
      }
    }
    
    // Check if token was created successfully
    const tokenAddress = await combinedKeyTest.lastCreatedToken();
    if (tokenAddress !== ethers.ZeroAddress) {
      console.log("\nToken created successfully at:", tokenAddress);
    } else {
      console.log("\nToken creation failed - no token address stored");
    }
  } catch (error: any) {
    console.error("\nError creating token:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 