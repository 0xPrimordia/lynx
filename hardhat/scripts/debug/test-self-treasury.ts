import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Testing token creation with self as treasury...");
  
  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);
  
  // Get deployment info
  const debugDeploymentPath = path.join(__dirname, "../../debug-deployment-info.json");
  if (!fs.existsSync(debugDeploymentPath)) {
    console.error("Debug deployment info not found.");
    return;
  }
  
  const deploymentInfo = JSON.parse(fs.readFileSync(debugDeploymentPath, "utf8"));
  
  if (!deploymentInfo.combinedKeyTestAddress) {
    console.error("No test contract address found.");
    return;
  }
  
  const testContract = deploymentInfo.combinedKeyTestAddress;
  console.log("Using test contract at:", testContract);
  
  // Get test contract instance
  const testHTS = await ethers.getContractAt("TestHTSWithCombinedKeys", testContract, deployer);
  
  // Check contract balance
  const contractBalance = await deployer.provider.getBalance(testContract);
  console.log("Contract balance:", ethers.formatEther(contractBalance), "HBAR");
  
  // Test token creation with self as treasury
  try {
    const tx = await testHTS.createControllerPatternSelfTreasury(
      "Self Treasury Test", 
      "STT", 
      "Testing with self as treasury",
      {
        gasLimit: 4000000,
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
    let eventCount = 0;
    for (const log of receipt.logs) {
      try {
        const parsedLog = testHTS.interface.parseLog({
          topics: log.topics,
          data: log.data
        });
        
        if (parsedLog) {
          eventCount++;
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
    
    if (eventCount === 0) {
      console.log("No events were emitted! This suggests the transaction failed silently.");
      console.log("This is the same pattern as in the main contract issue.");
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