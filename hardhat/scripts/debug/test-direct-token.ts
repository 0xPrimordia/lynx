import { ethers } from "hardhat";
import fs from "fs";
import { Log } from "@ethersproject/abstract-provider";

async function main() {
  console.log("Testing direct token creation...");

  // Get deployment info
  if (!fs.existsSync("debug-direct-deployment-info.json")) {
    console.error("Deployment info not found. Deploy the contract first with deploy-test-direct.ts");
    process.exit(1);
  }

  const deploymentInfo = JSON.parse(
    fs.readFileSync("debug-direct-deployment-info.json", "utf8")
  );
  const contractAddress = deploymentInfo.directtestContract;
  console.log("Using TestHTSDirect at:", contractAddress);

  // Get signer
  const [deployer] = await ethers.getSigners();
  console.log("Using account:", deployer.address);

  // Connect to the deployed contract
  const TestHTSDirect = await ethers.getContractFactory("TestHTSDirect");
  const testHTSDirect = TestHTSDirect.attach(contractAddress);

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

  // Test creating a token with direct call
  console.log("Testing direct token creation...");
  try {
    const tx1 = await testHTSDirect.createDirectToken({
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
          return TestHTSDirect.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
        } catch (e: any) {
          return null;
        }
      })
      .filter(Boolean);
    
    console.log("Events:", events?.map(e => ({ name: e?.name, args: e?.args })));
    console.log("Direct token creation test successful!");
  } catch (error) {
    console.error("Direct token creation failed:", error);
  }

  // Test creating a static token
  console.log("\nTesting static token creation...");
  try {
    const tx2 = await testHTSDirect.createStaticToken({
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
          return TestHTSDirect.interface.parseLog({
            topics: log.topics as string[],
            data: log.data
          });
        } catch (e: any) {
          return null;
        }
      })
      .filter(Boolean);
    
    console.log("Events:", events?.map(e => ({ name: e?.name, args: e?.args })));
    console.log("Static token creation test successful!");
  } catch (error) {
    console.error("Static token creation failed:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 