import { ethers } from "ethers";
import { getContractAt } from "hardhat"; // Adjusted import for Hardhat utilities

async function main() {
  console.log("Testing HTS Precompile Interaction...");

  const [deployer] = await ethers.getSigners();
  console.log("Using deployer account:", deployer.address);

  const controllerAddress = "<INSERT_CONTROLLER_ADDRESS>"; // Replace with actual controller address
  const controller = await getContractAt("IndexTokenController", controllerAddress, deployer);

  const name = "Test Token";
  const symbol = "TEST";
  const memo = "Testing HTS Precompile";

  console.log("Attempting to create token with parameters:");
  console.log("- Name:", name);
  console.log("- Symbol:", symbol);
  console.log("- Memo:", memo);

  try {
    const tx = await controller.createIndexToken(name, symbol, memo, {
      value: ethers.utils.parseEther("10.0"),
      gasLimit: 4000000,
      gasPrice: ethers.utils.parseUnits("600", "gwei")
    });

    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");

    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
  } catch (error: any) {
    console.error("Error during token creation:", error.message);
    if (error.data) {
      console.error("Error data:", error.data);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});