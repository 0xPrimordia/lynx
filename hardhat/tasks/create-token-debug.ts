import { task } from "hardhat/config";
import * as fs from "fs";
import * as path from "path";

task("create-token-debug", "Debug token creation with detailed logging")
  .setAction(async (taskArgs, hre) => {
    try {
      console.log("=== TOKEN CREATION DEBUG TASK ===");
      const { ethers } = hre;
      
      // Get deploymentInfo
      const deploymentInfoPath = path.join(__dirname, "../../deployment-info.json");
      const deploymentInfo = JSON.parse(fs.readFileSync(deploymentInfoPath, "utf8"));
      console.log("Controller address:", deploymentInfo.controllerEvm);
      
      // Get deployer account
      const [deployer] = await ethers.getSigners();
      console.log("Deployer:", deployer.address);
      console.log("Is EOA:", await ethers.provider.getCode(deployer.address) === "0x");
      console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "HBAR");
      
      // Verify controller has funds
      const controllerBalance = await ethers.provider.getBalance(deploymentInfo.controllerEvm);
      console.log("Controller balance:", ethers.formatEther(controllerBalance), "HBAR");
      if (controllerBalance < ethers.parseEther("5")) {
        console.warn("Controller balance may be too low for token creation");
      }
      
      // Get controller contract
      const controller = await ethers.getContractAt(
        "IndexTokenController",
        deploymentInfo.controllerEvm,
        deployer
      );
      
      // Print contract state
      console.log("\nContract state:");
      console.log("- ADMIN:", await controller.ADMIN());
      console.log("- Controller hasSupplyKey:", await controller.hasSupplyKey());
      console.log("- Current token address:", await controller.INDEX_TOKEN());
      
      // Token parameters
      const name = "Lynx Index Token";
      const symbol = "LYNX";
      const memo = "Lynx Index Token Debug";
      
      console.log("\nToken creation parameters:");
      console.log("- Name:", name);
      console.log("- Symbol:", symbol);
      console.log("- Memo:", memo);
      console.log("- Treasury (controller):", controller.target);
      
      console.log("\nSending transaction with gas limit: 15,000,000");
      const tx = await controller.createIndexToken(name, symbol, memo, {
        value: ethers.parseEther("10.0"),
        gasLimit: 15000000,
        gasPrice: ethers.parseUnits("600", "gwei")
      });
      
      console.log("Transaction hash:", tx.hash);
      console.log("Waiting for confirmation...");
      
      try {
        const receipt = await tx.wait();
        console.log("Transaction succeeded! Gas used:", receipt?.gasUsed?.toString());
        
        console.log("\nLogs from transaction:");
        if (receipt?.logs?.length) {
          for (const log of receipt.logs) {
            try {
              const parsedLog = controller.interface.parseLog(log);
              if (parsedLog) {
                console.log(`Event: ${parsedLog.name}`);
                console.log(`Args: ${JSON.stringify(parsedLog.args)}`);
              }
            } catch (e) {
              console.log("Unknown log:", log);
            }
          }
        } else {
          console.log("No logs in transaction");
        }
        
        // Check token status after transaction
        const tokenAddress = await controller.INDEX_TOKEN();
        console.log("\nToken address after tx:", tokenAddress);
        console.log("hasSupplyKey after tx:", await controller.hasSupplyKey());
      } catch (error: any) {
        console.error("Transaction failed:", error.message);
        if (error.receipt) {
          console.log("Receipt status:", error.receipt.status);
          console.log("Gas used:", error.receipt.gasUsed?.toString());
        }
      }
    } catch (error: any) {
      console.error("Error in task:", error.message);
    }
  });

export default {}; 