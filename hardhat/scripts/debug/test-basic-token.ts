import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Testing basic token creation...");
  
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
  
  // Token parameters
  const name = "Test Token Basic";
  const symbol = "TTB";
  
  console.log("\nAttempting to create basic token:");
  console.log("- Name:", name);
  console.log("- Symbol:", symbol);
  
  try {
    // Send transaction with HBAR for token creation fee
    const tx = await testHTS.createBasicToken(name, symbol, {
      value: ethers.parseEther("10.0"),
      gasLimit: 800000,
      gasPrice: ethers.parseUnits("530", "gwei")
    });
    
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