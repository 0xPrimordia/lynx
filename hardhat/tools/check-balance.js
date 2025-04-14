// Simple script to check the Hedera account balance before deployment
const { Client, AccountId, PrivateKey, AccountBalanceQuery } = require("@hashgraph/sdk");
require('dotenv').config({ path: '../.env.local' });

// Helper to convert Hedera ID to EVM address
function hederaIdToEvmAddress(hederaId) {
  const parts = hederaId.split('.');
  if (parts.length < 3) return "Invalid Hedera ID format";
  
  const num = parts[2];
  const paddedNum = num.padStart(40, '0');
  return `0x${paddedNum}`;
}

async function main() {
  try {
    // Get credentials from environment variables
    const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID;
    const operatorKey = process.env.OPERATOR_KEY;
    
    if (!operatorId || !operatorKey) {
      console.error("ERROR: Missing NEXT_PUBLIC_OPERATOR_ID or OPERATOR_KEY in .env.local file");
      process.exit(1);
    }
    
    console.log("Checking account balance for:", operatorId);
    console.log("EVM address equivalent:", hederaIdToEvmAddress(operatorId));
    
    // Create Hedera client and set the operator
    const client = Client.forTestnet();
    client.setOperator(
      AccountId.fromString(operatorId),
      PrivateKey.fromString(operatorKey)
    );
    
    // Query the account balance
    const balanceQuery = await new AccountBalanceQuery()
      .setAccountId(AccountId.fromString(operatorId))
      .execute(client);
    
    const balance = balanceQuery.hbars;
    const balanceNumber = parseFloat(balance.toString().replace(' ℏ', ''));
    
    // Display balance and requirements
    console.log(`Current account balance: ${balance.toString()}`);
    console.log("\nDeployment requirements:");
    console.log("- Minimum: 30 HBAR recommended");
    console.log("- High gas prices (530 gwei): 50+ HBAR recommended");
    
    // Evaluate if balance is sufficient
    if (balanceNumber < 15) {
      console.log("\n⚠️  WARNING: Balance too low for deployment!");
    } else if (balanceNumber < 30) {
      console.log("\n⚠️  WARNING: Balance may be insufficient for full deployment with high gas prices!");
    } else {
      console.log("\n✓ Balance should be sufficient for deployment");
    }
    
    // Check Hardhat configuration
    try {
      const hardhatConfig = require('../hardhat.config');
      const networkConfig = hardhatConfig.networks?.hederaTestnet;
      if (networkConfig) {
        const accounts = networkConfig.accounts;
        if (Array.isArray(accounts) && accounts.length > 0) {
          console.log("\nHardhat configuration check:");
          console.log(`- Network: hederaTestnet`);
          console.log(`- Account(s): ${accounts.length} account(s) configured`);
        } else if (typeof accounts === 'string') {
          console.log("\nHardhat configuration check:");
          console.log(`- Network: hederaTestnet`);
          console.log(`- Using account from: ${accounts}`);
        }
      }
    } catch (error) {
      console.log("\nCould not verify Hardhat configuration:", error.message);
    }
    
    // Return the specific balance value
    return balanceNumber;
    
  } catch (error) {
    console.error("Error checking balance:", error.message || error);
    return 0;
  }
}

// Execute the script
main()
  .then((balance) => {
    if (balance === 0) {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 