import { ethers } from "hardhat";
import fs from "fs";
import { Log } from "@ethersproject/abstract-provider";

async function main() {
  console.log("Testing minimal token creation...");

  // Get deployment info
  if (!fs.existsSync("debug-minimal-deployment-info.json")) {
    console.error("Deployment info not found. Deploy the contract first with deploy-test-minimal.ts");
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(
    fs.readFileSync("debug-minimal-deployment-info.json", "utf8")
  );
  const contractAddress = deploymentInfo.minimaltestContract;
  console.log("Using TestHTSMinimal at:", contractAddress);

  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Connect to the deployed contract
  const TestHTSMinimal = await ethers.getContractFactory("TestHTSMinimal");
  const testHTSMinimal = TestHTSMinimal.attach(contractAddress);

  // Fund the contract with 5 HBAR if needed
  const contractBalance = await ethers.provider.getBalance(contractAddress);
  if (contractBalance < ethers.parseEther("5.0")) {
    console.log("Funding contract with 5 HBAR...");
    const tx = await deployer.sendTransaction({
      to: contractAddress,
      value: ethers.parseEther("5.0"),
      gasLimit: 400000,
      gasPrice: ethers.parseUnits("530", "gwei"),
    });
    await tx.wait();
    console.log("Contract funded");
  } else {
    console.log("Contract already has sufficient funds");
  }

  // Test creating a token with minimal key structure
  console.log("Testing minimal key structure token creation...");
  try {
    const tx1 = await testHTSMinimal.createMinimalToken({
      gasLimit: 4000000,
      gasPrice: ethers.parseUnits("530", "gwei"),
    });
    console.log("Transaction hash:", tx1.hash);
    console.log("Waiting for transaction confirmation...");
    const receipt1 = await tx1.wait();
    console.log("Transaction confirmed in block:", receipt1?.blockNumber);
    
    // Parse events
    const events = receipt1?.logs
      .filter((log: Log) => log.address === contractAddress)
      .map((log: Log) => {
        try {
          return TestHTSMinimal.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
        } catch (e: unknown) {
          return null;
        }
      })
      .filter(Boolean);
    
    console.log("Events:", events?.map(e => ({ name: e?.name, args: e?.args })));
    console.log("Minimal token creation test successful!");
  } catch (error) {
    console.error("Minimal token creation failed:", error);
  }

  // Test creating a token with no keys
  console.log("\nTesting token creation with no keys...");
  try {
    const tx2 = await testHTSMinimal.createNoKeysToken({
      gasLimit: 4000000,
      gasPrice: ethers.parseUnits("530", "gwei"),
    });
    console.log("Transaction hash:", tx2.hash);
    console.log("Waiting for transaction confirmation...");
    const receipt2 = await tx2.wait();
    console.log("Transaction confirmed in block:", receipt2?.blockNumber);
    
    // Parse events
    const events = receipt2?.logs
      .filter((log: Log) => log.address === contractAddress)
      .map((log: Log) => {
        try {
          return TestHTSMinimal.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
        } catch (e: unknown) {
          return null;
        }
      })
      .filter(Boolean);
    
    console.log("Events:", events?.map(e => ({ name: e?.name, args: e?.args })));
    console.log("No keys token creation test successful!");
  } catch (error) {
    console.error("No keys token creation failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 