import { 
  Client, 
  AccountId, 
  PrivateKey, 
  TokenCreateTransaction, 
  TokenType, 
  TokenSupplyType, 
  TokenInfoQuery,
  TokenMintTransaction,
  Hbar,
  TokenAssociateTransaction
} from "@hashgraph/sdk";
import * as fs from "fs";
import * as dotenv from "dotenv";
import * as path from "path";

// Load environment variables
dotenv.config({ path: "../.env.local" });

// Setup Hedera credentials
const operatorId = process.env.NEXT_PUBLIC_OPERATOR_ID || "";
const operatorKey = process.env.OPERATOR_KEY || "";

if (!operatorId || !operatorKey) {
  throw new Error("Environment variables NEXT_PUBLIC_OPERATOR_ID and OPERATOR_KEY must be set");
}

// Test token configurations
const TEST_TOKENS = [
  {
    name: "Wrapped Bitcoin (Test)",
    symbol: "WBTC",
    decimals: 8,
    initialSupply: 1000000, // 10 WBTC (8 decimals)
    description: "Test token representing Wrapped Bitcoin"
  },
  {
    name: "USD Coin (Test)", 
    symbol: "USDC",
    decimals: 6,
    initialSupply: 100000000000, // 100,000 USDC (6 decimals)
    description: "Test token representing USD Coin"
  },
  {
    name: "Jam Token (Test)",
    symbol: "JAM", 
    decimals: 8,
    initialSupply: 1000000000000, // 10,000 JAM (8 decimals)
    description: "Test token representing Jam Token"
  },
  {
    name: "HeadStarter (Test)",
    symbol: "HEADSTART",
    decimals: 8, 
    initialSupply: 500000000000, // 5,000 HEADSTART (8 decimals)
    description: "Test token representing HeadStarter"
  }
];

async function main() {
  console.log("CREATING TEST TOKENS FOR LYNX MINTING");
  console.log("====================================");
  console.log(`Using operator account: ${operatorId}`);
  
  // Initialize Hedera client
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  
  const treasuryId = AccountId.fromString(operatorId);
  const adminKey = PrivateKey.fromString(operatorKey).publicKey;
  const supplyKey = PrivateKey.fromString(operatorKey).publicKey;
  
  const createdTokens: Array<{
    symbol: string;
    tokenId: string;
    evmAddress: string;
    name: string;
    decimals: number;
    supply: number;
  }> = [];
  
  console.log("\nCreating test tokens...\n");
  
  for (const tokenConfig of TEST_TOKENS) {
    try {
      console.log(`Creating ${tokenConfig.symbol} (${tokenConfig.name})...`);
      
      // Create token
      const tokenCreateTx = new TokenCreateTransaction()
        .setTokenName(tokenConfig.name)
        .setTokenSymbol(tokenConfig.symbol)
        .setDecimals(tokenConfig.decimals)
        .setInitialSupply(0) // Start with 0, mint after creation
        .setTokenType(TokenType.FungibleCommon)
        .setSupplyType(TokenSupplyType.Infinite)
        .setTreasuryAccountId(treasuryId)
        .setAdminKey(adminKey)
        .setSupplyKey(supplyKey)
        .setTokenMemo(tokenConfig.description)
        .setMaxTransactionFee(new Hbar(30));
      
      console.log(`  - Submitting creation transaction...`);
      const txResponse = await tokenCreateTx.execute(client);
      const receipt = await txResponse.getReceipt(client);
      
      const tokenId = receipt.tokenId;
      if (!tokenId) {
        throw new Error(`Failed to create ${tokenConfig.symbol} - no token ID in receipt`);
      }
      
      console.log(`  - Token created with ID: ${tokenId.toString()}`);
      
      // Associate operator account with token (treasury is auto-associated, but being explicit)
      console.log(`  - Ensuring operator account is associated with token...`);
      try {
        const associateTx = new TokenAssociateTransaction()
          .setAccountId(treasuryId)
          .setTokenIds([tokenId])
          .setMaxTransactionFee(new Hbar(5));
        
        const associateResponse = await associateTx.execute(client);
        await associateResponse.getReceipt(client);
        console.log(`  - Association confirmed`);
      } catch (error: any) {
        // If already associated (which should be the case for treasury), this will fail gracefully
        if (error.message?.includes('TOKEN_ALREADY_ASSOCIATED_TO_ACCOUNT')) {
          console.log(`  - Account already associated (expected for treasury)`);
        } else {
          console.log(`  - Association warning: ${error.message}`);
        }
      }
      
      // Mint initial supply
      console.log(`  - Minting initial supply of ${tokenConfig.initialSupply}...`);
      const mintTx = new TokenMintTransaction()
        .setTokenId(tokenId)
        .setAmount(tokenConfig.initialSupply)
        .setMaxTransactionFee(new Hbar(10));
      
      const mintResponse = await mintTx.execute(client);
      await mintResponse.getReceipt(client);
      
      // Get token info to verify
      const tokenInfo = await new TokenInfoQuery()
        .setTokenId(tokenId)
        .execute(client);
      
      const evmAddress = `0x${tokenId.toSolidityAddress()}`;
      
      console.log(`  ✅ ${tokenConfig.symbol} created successfully!`);
      console.log(`     - Token ID: ${tokenId.toString()}`);
      console.log(`     - EVM Address: ${evmAddress}`);
      console.log(`     - Total Supply: ${tokenInfo.totalSupply.toString()}`);
      console.log(`     - Decimals: ${tokenInfo.decimals}`);
      console.log("");
      
      createdTokens.push({
        symbol: tokenConfig.symbol,
        tokenId: tokenId.toString(),
        evmAddress: evmAddress,
        name: tokenConfig.name,
        decimals: tokenConfig.decimals,
        supply: tokenConfig.initialSupply
      });
      
    } catch (error) {
      console.error(`❌ Error creating ${tokenConfig.symbol}:`, error);
    }
  }
  
  // Save token information to a file
  const testTokensPath = path.join(__dirname, "../test-tokens.json");
  const testTokensInfo = {
    createdAt: new Date().toISOString(),
    network: "testnet",
    operatorAccount: operatorId,
    tokens: createdTokens.reduce((acc, token) => {
      acc[token.symbol] = {
        tokenId: token.tokenId,
        evmAddress: token.evmAddress,
        name: token.name,
        decimals: token.decimals,
        initialSupply: token.supply
      };
      return acc;
    }, {} as Record<string, any>)
  };
  
  fs.writeFileSync(testTokensPath, JSON.stringify(testTokensInfo, null, 2));
  
  console.log("🎉 TEST TOKEN CREATION COMPLETE!");
  console.log("===============================");
  console.log(`Created ${createdTokens.length} test tokens`);
  console.log(`Token information saved to: ${testTokensPath}`);
  
  console.log("\n📝 Environment Variables to Add:");
  console.log("Add these to your .env.local file:");
  createdTokens.forEach(token => {
    console.log(`NEXT_PUBLIC_${token.symbol}_TOKEN_ID=${token.tokenId}`);
    console.log(`NEXT_PUBLIC_${token.symbol}_TOKEN_EVM_ID=${token.evmAddress}`);
  });
  
  console.log("\n🔧 Next Steps:");
  console.log("1. Add the environment variables above to your .env.local file");
  console.log("2. Update your TOKEN_INFO configuration with the new token IDs");
  console.log("3. Test the minting flow with these new test tokens");
  console.log("4. (Optional) Associate these tokens with your test accounts");
  
  console.log("\n💰 Token Balances:");
  console.log(`Your account (${operatorId}) now has:`);
  createdTokens.forEach(token => {
    const readableAmount = (token.supply / Math.pow(10, token.decimals)).toLocaleString();
    console.log(`  - ${readableAmount} ${token.symbol}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  }); 