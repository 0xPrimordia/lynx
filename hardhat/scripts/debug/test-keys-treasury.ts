import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("Testing token creation with different key configurations...");
  
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
  
  // Get deployment info
  const mainDeploymentPath = path.join(__dirname, "../../../deployment-info.json");
  const mainDeploymentInfo = JSON.parse(fs.readFileSync(mainDeploymentPath, "utf8"));
  const vaultAddress = mainDeploymentInfo.vaultEvm;
  
  console.log("Main vault address:", vaultAddress);
  
  // Run test functions in sequence
  const tests = [
    { name: "Admin Key", func: "createTokenWithAdminKey", args: ["Test Token Admin", "TTA"] },
    { name: "Supply Key", func: "createTokenWithSupplyKey", args: ["Test Token Supply", "TTS"] },
    { name: "Auto Renew", func: "createTokenWithAutoRenew", args: ["Test Token Auto", "TTR"] },
    { name: "Vault Treasury", func: "createTokenWithTreasury", args: ["Test Token Vault", "TTV", vaultAddress] }
  ];
  
  for (const test of tests) {
    console.log(`\n===== Testing ${test.name} =====`);
    
    try {
      // Call the test function with HBAR for token creation fee
      const tx = await (testHTS as any)[test.func](...test.args, {
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
        console.log(`\n${test.name} token created successfully at:`, tokenAddress);
      } else {
        console.log(`\n${test.name} token creation failed - no token address stored`);
      }
    } catch (error: any) {
      console.error(`\nError creating ${test.name} token:`, error.message);
      if (error.data) {
        console.error("Error data:", error.data);
      }
    }
    
    // Wait a bit between tests
    console.log("Waiting 5 seconds before next test...");
    await new Promise(resolve => setTimeout(resolve, 5000));
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 