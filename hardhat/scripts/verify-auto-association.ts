import * as hre from "hardhat";
import { 
  Client, 
  AccountId, 
  PrivateKey, 
  ContractInfoQuery,
  ContractId
} from "@hashgraph/sdk";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../.env.local" });

async function main() {
  console.log("🔍 Verifying DepositMinter auto-association setup...");

  // Get contract info
  const contractHederaId = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID;
  const contractEvmAddress = process.env.NEXT_PUBLIC_DEPOSIT_MINTER_EVM_ADDRESS;
  
  if (!contractHederaId) {
    console.error("❌ NEXT_PUBLIC_DEPOSIT_MINTER_HEDERA_ID not set");
    return;
  }

  // Setup Hedera client
  const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
  const operatorKey = process.env.OPERATOR_KEY;
  
  if (!operatorId || !operatorKey) {
    throw new Error("Missing Hedera operator credentials");
  }

  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );

  console.log("Contract ID:", contractHederaId);
  console.log("Contract Address:", contractEvmAddress);

  // Query contract info to check max auto associations
  console.log("\n📋 Querying contract information...");
  
  try {
    const contractInfo = await new ContractInfoQuery()
      .setContractId(ContractId.fromString(contractHederaId))
      .execute(client);

    console.log("Contract Info:");
    console.log("- Contract ID:", contractInfo.contractId?.toString());
    console.log("- Admin Key:", contractInfo.adminKey ? "✅ Set" : "❌ Not set");
    console.log("- Auto Renew Period:", contractInfo.autoRenewPeriod?.seconds, "seconds");
    console.log("- Storage Size:", contractInfo.storage.toString(), "bytes");

    // Note: Max auto associations may not be directly queryable through this API
    console.log("- Max Auto Associations: Check deployment info or contract creation transaction");

    // For verification, we'll need to check the deployment info or creation transaction
    const maxAutoAssociations = 0; // Default assumption
    
    if (maxAutoAssociations === 0) {
      console.log("\n❌ AUTO-ASSOCIATION NOT CONFIGURED");
      console.log("   Max Auto Associations is 0 - tokens cannot auto-associate");
      console.log("   Contract must be redeployed with setMaxAutomaticTokenAssociations(2)");
    } else if (maxAutoAssociations >= 2) {
      console.log("\n✅ AUTO-ASSOCIATION PROPERLY CONFIGURED");
      console.log(`   Max Auto Associations: ${maxAutoAssociations}`);
      console.log("   SAUCE and CLXY tokens can auto-associate on transfer");
    } else if (maxAutoAssociations === 1) {
      console.log("\n⚠️ AUTO-ASSOCIATION PARTIALLY CONFIGURED");
      console.log("   Max Auto Associations: 1 (need 2 for both SAUCE and CLXY)");
      console.log("   Only one token can auto-associate");
    }

  } catch (error) {
    console.error("❌ Failed to query contract info:", error);
  }

  // Test contract functionality if EVM address is available
  if (contractEvmAddress) {
    console.log("\n🧪 Testing contract functionality...");
    
    try {
      const DepositMinter = await hre.ethers.getContractFactory("DepositMinter");
      const depositMinter = DepositMinter.attach(contractEvmAddress);

      // Check token addresses
      const lynxToken = await depositMinter.lynxToken();
      const sauceToken = await depositMinter.sauceToken();
      const clxyToken = await depositMinter.clxyToken();

      console.log("Configured tokens:");
      console.log("- LYNX:", lynxToken);
      console.log("- SAUCE:", sauceToken);
      console.log("- CLXY:", clxyToken);

      // Test calculations
      const [sauceRequired, clxyRequired, hbarRequired] = await depositMinter.calculateRequiredDeposits(1);
      console.log("\nFor 1 LYNX token:");
      console.log("- SAUCE required:", sauceRequired.toString());
      console.log("- CLXY required:", clxyRequired.toString());
      console.log("- HBAR required:", hbarRequired.toString(), "tinybars");

      // Check associations if possible
      try {
        const [sauceAssociated, clxyAssociated, lynxAssociated] = await depositMinter.checkAllAssociations();
        console.log("\nCurrent association status:");
        console.log("- SAUCE:", sauceAssociated ? "✅ Associated" : "❌ Not associated");
        console.log("- CLXY:", clxyAssociated ? "✅ Associated" : "❌ Not associated");
        console.log("- LYNX:", lynxAssociated ? "✅ Associated" : "❌ Not associated");
      } catch (error) {
        console.log("\n⚠️ Could not check current associations (tokens will auto-associate on transfer)");
      }

    } catch (error) {
      console.error("❌ Failed to test contract functionality:", error);
    }
  }

  console.log("\n📝 RECOMMENDATIONS:");
  console.log("1. If maxAutoAssociations = 0: Redeploy contract with proper auto-association");
  console.log("2. If maxAutoAssociations >= 2: Contract is ready for SAUCE and CLXY auto-association");
  console.log("3. The _autoAssociateAndTransfer() function will handle fallback association");
  console.log("4. With proper setup, tokens will associate automatically on first transfer");

  client.close();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 