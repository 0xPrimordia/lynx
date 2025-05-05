import { ethers } from "hardhat";
import * as fs from "fs";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "./.env.local" });

// ABI for the IHederaTokenService precompile
const precompileAbi = [
  {
    inputs: [
      {
        internalType: "address",
        name: "token",
        type: "address"
      },
      {
        internalType: "uint256",
        name: "amount",
        type: "uint256"
      },
      {
        internalType: "bytes[]",
        name: "metadata",
        type: "bytes[]"
      }
    ],
    name: "mintToken",
    outputs: [
      {
        internalType: "int64",
        name: "responseCode",
        type: "int64"
      }
    ],
    stateMutability: "nonpayable",
    type: "function"
  }
];

async function main() {
  console.log("Direct Token Mint Test");
  console.log("=====================");
  
  // Check if results file exists
  if (!fs.existsSync("hybrid-approach-test-results.json")) {
    console.error("No test results found. Please run hybrid-token-mint-test.ts first.");
    process.exit(1);
  }

  // Read the token info from the test results
  const testResults = JSON.parse(fs.readFileSync("hybrid-approach-test-results.json", "utf8"));
  const { tokenAddress } = testResults;
  
  console.log("Token address:", tokenAddress);
  
  // Get a signer
  const [signer] = await ethers.getSigners();
  console.log("Using signer:", signer.address);
  
  // Create an instance of the IHederaTokenService precompile
  const htsPrecompile = new ethers.Contract(
    "0x0000000000000000000000000000000000000167",
    precompileAbi,
    signer
  );
  
  // Attempt to mint tokens directly
  console.log("\nAttempting to mint tokens directly...");
  try {
    const mintAmount = 1000n;
    const emptyMetadata: string[] = [];
    
    // Call the mintToken function on the precompile
    const tx = await htsPrecompile.mintToken(
      tokenAddress,
      mintAmount,
      emptyMetadata,
      {
        gasLimit: 1000000,
        gasPrice: ethers.parseUnits("530", "gwei")
      }
    );
    
    console.log("Transaction submitted:", tx.hash);
    console.log("Waiting for confirmation...");
    
    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    
    // Check the result - if we get here, it was successful
    console.log("\n✅ DIRECT MINT SUCCESSFUL!");
    
    // Save the updated test results
    testResults.directMintSuccess = true;
    fs.writeFileSync(
      "hybrid-approach-test-results.json",
      JSON.stringify(testResults, null, 2)
    );
    
  } catch (error) {
    console.error("Direct mint failed:", error);
    console.log("\n❌ DIRECT MINT FAILED!");
    
    // Save the failure result
    testResults.directMintSuccess = false;
    fs.writeFileSync(
      "hybrid-approach-test-results.json",
      JSON.stringify(testResults, null, 2)
    );
    
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 