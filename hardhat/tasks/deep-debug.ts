import { task } from "hardhat/config";
import * as fs from "fs";
import * as path from "path";

task("deep-debug", "Debug token creation with more detailed tracing")
  .addOptionalParam("name", "Token name", "Lynx Index Token")
  .addOptionalParam("symbol", "Token symbol", "LYNX")
  .addOptionalParam("memo", "Token memo", "Lynx Index Token Debug")
  .setAction(async (taskArgs, hre) => {
    const ethers = hre.ethers;
    try {
      console.log("=== DEEP DEBUG TOKEN CREATION ===");
      
      // Get deployment info
      const deploymentInfoPath = path.join(__dirname, "../../deployment-info.json");
      const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, "utf8"));
      
      // Get deployer account
      const [deployer] = await ethers.getSigners();
      console.log(`Deployer: ${deployer.address}`);
      console.log(`Deployer balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} HBAR`);
      
      // Check vault contract
      const vault = await ethers.getContractAt("IndexVault", deploymentInfo.vaultEvm);
      console.log(`\nVault contract at: ${vault.target}`);
      console.log(`Vault controller: ${await vault.controller()}`);
      console.log(`Vault admin: ${await vault.admin()}`);
      
      // Check controller contract
      const controller = await ethers.getContractAt("IndexTokenController", deploymentInfo.controllerEvm);
      console.log(`\nController contract at: ${controller.target}`);
      console.log(`Controller ADMIN: ${await controller.ADMIN()}`);
      console.log(`Controller VAULT: ${await controller.vault()}`);
      console.log(`Controller HTS address: ${await controller.HTS_PRECOMPILE()}`);
      
      // Check if addresses match
      console.log(`\nChecking contract references:`);
      const vaultControllerMatches = (await vault.controller()).toLowerCase() === controller.target.toLowerCase();
      console.log(`- Vault controller matches deployed controller: ${vaultControllerMatches}`);
      
      const controllerVaultMatches = (await controller.vault()).toLowerCase() === vault.target.toLowerCase();
      console.log(`- Controller vault matches deployed vault: ${controllerVaultMatches}`);
      
      if (!vaultControllerMatches || !controllerVaultMatches) {
        console.log("⚠️ Contract references don't match! This could cause issues with token creation.");
      }
      
      // Break down the token creation function and test each part
      console.log("\nBreaking down token creation steps:");
      
      // First, try to encode the function call to check for parameter issues
      try {
        console.log("1. Encoding function call...");
        const tokenParams = [taskArgs.name, taskArgs.symbol, taskArgs.memo];
        const data = controller.interface.encodeFunctionData("createIndexToken", tokenParams);
        console.log(`Function encoding successful: ${data.substring(0, 20)}...`);
      } catch (err) {
        console.error("Function encoding failed:", err.message);
        return;
      }
      
      // Prepare a super low gas estimate transaction to just check gas requirements
      try {
        console.log("\n2. Estimating gas (this will intentionally fail but show gas requirements)...");
        const tx = await controller.createIndexToken.estimateGas(
          taskArgs.name, 
          taskArgs.symbol, 
          taskArgs.memo, 
          { value: ethers.parseEther("10.0") }
        ).catch(err => {
          if (err.message.includes("gas required exceeds")) {
            console.log(`Gas estimation suggests more gas is needed than block limit`);
            console.log(`Error: ${err.message}`);
          } else {
            console.log(`Other error during gas estimation: ${err.message}`);
          }
        });
      } catch (error) {
        console.log(`Error during gas estimation step: ${error.message}`);
      }
      
      // Direct check of the HTS precompile
      console.log("\n3. Checking HTS precompile access...");
      try {
        // Create a minimal interface for the HTS precompile
        const htsInterface = new ethers.Interface([
          "function balanceOf(address token, address account) external view returns (uint256)"
        ]);
        
        // Try to call a simple view function on the HTS address
        const htsAddress = "0x0000000000000000000000000000000000000167";
        const htsContract = new ethers.Contract(htsAddress, htsInterface, deployer);
        
        try {
          // Call a simple view function (should fail in a specific way if precompile exists)
          console.log("Calling balanceOf on HTS precompile...");
          await htsContract.balanceOf(ethers.ZeroAddress, deployer.address);
        } catch (err) {
          if (err.message.includes("execution reverted")) {
            console.log("✅ HTS precompile is accessible (reverted as expected)");
          } else {
            console.log(`⚠️ Unexpected error when accessing HTS: ${err.message}`);
          }
        }
      } catch (error) {
        console.log(`Error checking HTS precompile: ${error.message}`);
      }

      console.log("\nCreating a token manually instead of via controller:");
      
      // Create minimal HTS interface
      const minimalHtsInterface = new ethers.Interface([
        "function createToken(tuple(string name, string symbol, address treasury, string memo, bool supplyType, uint32 maxSupply, bool freezeDefault, address[] freezeKey, address[] wipeKey, address[] supplyKey, address[] adminKey, address[] kycKey, uint8 decimals, address autoRenewAccount, uint32 autoRenewPeriod) token, uint initialSupply, uint8[] keys, address[] keyAddresses) external payable returns (int64, address)"
      ]);
      
      // Create contract instance for the precompile
      const htsAddress = "0x0000000000000000000000000000000000000167";
      const htsContract = new ethers.Contract(htsAddress, minimalHtsInterface, deployer);
      
      try {
        console.log("Preparing direct token creation call...");
        
        // Parameters for token creation
        const name = taskArgs.name;
        const symbol = taskArgs.symbol;
        const memo = taskArgs.memo;
        
        // Create empty arrays for keys
        const emptyAddressArray = [];
        
        // Create admin key array
        const adminKeyArray = [deployer.address];
        
        // Create supply key array
        const supplyKeyArray = [controller.target];
        
        // Token structure similar to controller's
        const token = {
          name: name,
          symbol: symbol,
          treasury: vault.target,  // Use vault as treasury
          memo: memo,
          supplyType: true,        // Infinite supply
          maxSupply: 0,            // No max supply
          freezeDefault: false,
          freezeKey: emptyAddressArray,
          wipeKey: emptyAddressArray,
          supplyKey: supplyKeyArray,
          adminKey: adminKeyArray,
          kycKey: emptyAddressArray,
          decimals: 8,
          autoRenewAccount: deployer.address, // Use deployer not contract
          autoRenewPeriod: 7000000            // About 90 days
        };
        
        // Key types and addresses
        const keyTypes = [1, 4, 8]; // Admin, Supply, AutoRenew
        const keyAddresses = [deployer.address, controller.target, deployer.address];
        
        // Log parameters 
        console.log("Token parameters:");
        console.log(`- Name: ${name}`);
        console.log(`- Symbol: ${symbol}`);
        console.log(`- Treasury: ${vault.target}`);
        console.log(`- AutoRenewAccount: ${deployer.address}`);
        
        // Try to execute the transaction with 15M gas
        console.log("\nSending transaction with 15M gas limit...");
        const tx = await htsContract.createToken.populateTransaction(
          token,
          0,  // Initial supply
          keyTypes,
          keyAddresses
        );
        
        // Send the transaction manually
        const txResponse = await deployer.sendTransaction({
          to: htsAddress,
          data: tx.data,
          value: ethers.parseEther("10.0"),
          gasLimit: 15000000,
        });
        
        console.log(`Transaction hash: ${txResponse.hash}`);
        console.log("Waiting for transaction confirmation...");
        
        try {
          const receipt = await txResponse.wait();
          if (receipt.status === 1) {
            console.log("Transaction succeeded!");
            
            // Save the token address if we can find it
            if (receipt.logs && receipt.logs.length > 0) {
              // We need to check the logs to find the token address
              console.log("Transaction logs:", receipt.logs);
              console.log("You'll need to check the logs to find the token address");
            }
          } else {
            console.log("Transaction failed with status 0");
          }
        } catch (err) {
          console.log("Transaction failed:", err.message);
        }
      } catch (error) {
        console.error("Error during direct token creation:", error.message);
      }
      
    } catch (error) {
      console.error("Deep debug error:", error);
    }
  });

export default {}; 