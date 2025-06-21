import * as hre from "hardhat";
import * as dotenv from "dotenv";

dotenv.config({ path: "../.env.local" });

async function main() {
    console.log("🔗 Associating DepositMinter contract with tokens...");
    
    const [deployer] = await hre.ethers.getSigners();
    console.log("Using account:", deployer.address);
    
    // Get contract address from deployment info
    const deploymentInfo = require('../deposit-minter-info.json');
    const contractAddress = deploymentInfo.contractAddress;
    
    console.log("Contract address:", contractAddress);
    
    // Get contract instance
    const DepositMinter = await hre.ethers.getContractFactory("DepositMinter");
    const contract = DepositMinter.attach(contractAddress);
    
    // Call associateWithTokens
    console.log("Calling associateWithTokens...");
    const tx = await contract.associateWithTokens({
        gasLimit: 1000000,
        gasPrice: hre.ethers.parseUnits("620", "gwei"),
    });
    
    console.log("Transaction hash:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("✅ Transaction confirmed!");
    console.log("Gas used:", receipt.gasUsed.toString());
    
    // Check for events
    if (receipt.logs && receipt.logs.length > 0) {
        console.log(`📝 ${receipt.logs.length} events emitted:`);
        receipt.logs.forEach((log: any, index: number) => {
            console.log(`Event ${index}:`, log.topics[0]);
        });
    }
    
    console.log("🎉 Token association complete!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error("❌ Error:", error);
        process.exit(1);
    }); 