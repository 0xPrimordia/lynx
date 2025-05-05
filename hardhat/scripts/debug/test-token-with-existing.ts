import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Testing token creation with existing contract...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  console.log("Account balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "HBAR");
  
  // Get deployment info
  const debugDeploymentPath = path.join(__dirname, "../../debug-deployment-info.json");
  if (!fs.existsSync(debugDeploymentPath)) {
    console.error("Debug deployment info not found.");
    return;
  }
  
  const deploymentInfo = JSON.parse(fs.readFileSync(debugDeploymentPath, "utf8"));
  
  // Use the most recently deployed contract
  const testContract = deploymentInfo.combinedKeyTestAddress;
  if (!testContract) {
    console.error("No test contract address found.");
    return;
  }
  
  console.log("Using test contract at:", testContract);
  
  // Check contract balance
  const contractBalance = await deployer.provider.getBalance(testContract);
  console.log("Contract balance:", ethers.formatEther(contractBalance), "HBAR");
  
  if (contractBalance < ethers.parseEther("3.0")) {
    console.log("Contract balance is low. Sending additional funds...");
    const tx = await deployer.sendTransaction({
      to: testContract,
      value: ethers.parseEther("3.0"),
      gasLimit: 100000,
      gasPrice: ethers.parseUnits("530", "gwei")
    });
    
    console.log("Funding transaction hash:", tx.hash);
    await tx.wait();
    console.log("Funding complete!");
    
    const newBalance = await deployer.provider.getBalance(testContract);
    console.log("New contract balance:", ethers.formatEther(newBalance), "HBAR");
  }
  
  // Get test contract instance
  const testHTS = await ethers.getContractAt("TestHTSWithCombinedKeys", testContract, deployer);
  
  // Test token creation with same parameters as in the main controller
  console.log("\n===== Testing Controller Pattern with Self Treasury =====");
  try {
    const tx = await testHTS.createControllerPatternSelfTreasury(
      "Controller Pattern", 
      "CPS", 
      "Testing Controller Pattern with Self Treasury",
      {
        // Note: Not sending value with the transaction - contract has its own balance
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
        const parsedLog = testHTS.interface.parseLog({
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
    const tokenAddress = await testHTS.lastCreatedToken();
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
  
  // Get main vault address
  const mainDeploymentPath = path.join(__dirname, "../../../deployment-info.json");
  const mainDeploymentInfo = JSON.parse(fs.readFileSync(mainDeploymentPath, "utf8"));
  const vaultAddress = mainDeploymentInfo.vaultEvm;
  
  console.log("\n===== Testing Controller Pattern with Vault Treasury =====");
  try {
    const tx = await testHTS.createExactControllerCopy(
      "Controller Pattern Vault", 
      "CPV", 
      "Testing Controller Pattern with Vault Treasury",
      vaultAddress,
      {
        // Note: Not sending value with the transaction - contract has its own balance
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
        const parsedLog = testHTS.interface.parseLog({
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
    const tokenAddress = await testHTS.lastCreatedToken();
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