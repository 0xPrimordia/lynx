import { 
  Client, 
  AccountId, 
  PrivateKey, 
  TokenMintTransaction,
  TokenInfoQuery,
  Hbar
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

// Additional mint amounts (you can modify these as needed)
const ADDITIONAL_MINT_AMOUNTS = {
  WBTC: 500000,        // 0.005 WBTC (8 decimals)
  USDC: 50000000000,   // 50,000 USDC (6 decimals)
  JAM: 500000000000,   // 5,000 JAM (8 decimals)
  HEADSTART: 250000000000  // 2,500 HEADSTART (8 decimals)
};

async function main() {
  console.log("MINTING ADDITIONAL TEST TOKENS");
  console.log("==============================");
  console.log(`Using operator account: ${operatorId}`);
  
  // Load existing test tokens info
  const testTokensPath = path.join(__dirname, "../test-tokens.json");
  
  if (!fs.existsSync(testTokensPath)) {
    throw new Error(`Test tokens file not found at ${testTokensPath}. Please run create-test-tokens.ts first.`);
  }
  
  const testTokensInfo = JSON.parse(fs.readFileSync(testTokensPath, "utf8"));
  console.log(`\nLoaded test tokens created on: ${testTokensInfo.createdAt}`);
  console.log(`Network: ${testTokensInfo.network}`);
  
  // Initialize Hedera client
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );
  
  console.log("\nMinting additional supply for test tokens...\n");
  
  const mintResults: Array<{
    symbol: string;
    tokenId: string;
    previousSupply: string;
    newSupply: string;
    amountMinted: number;
  }> = [];
  
  for (const [symbol, tokenData] of Object.entries(testTokensInfo.tokens)) {
    const tokenInfo = tokenData as any;
    const additionalAmount = ADDITIONAL_MINT_AMOUNTS[symbol as keyof typeof ADDITIONAL_MINT_AMOUNTS];
    
    if (!additionalAmount) {
      console.log(`⏭️  Skipping ${symbol} - no additional mint amount configured`);
      continue;
    }
    
    try {
      console.log(`Minting additional ${symbol}...`);
      console.log(`  - Token ID: ${tokenInfo.tokenId}`);
      
      // Get current token info
      const currentTokenInfo = await new TokenInfoQuery()
        .setTokenId(tokenInfo.tokenId)
        .execute(client);
      
      const previousSupply = currentTokenInfo.totalSupply.toString();
      console.log(`  - Current supply: ${previousSupply}`);
      console.log(`  - Minting additional: ${additionalAmount.toLocaleString()}`);
      
      // Mint additional tokens
      const mintTx = new TokenMintTransaction()
        .setTokenId(tokenInfo.tokenId)
        .setAmount(additionalAmount)
        .setMaxTransactionFee(new Hbar(10));
      
      const mintResponse = await mintTx.execute(client);
      await mintResponse.getReceipt(client);
      
      // Get updated token info
      const updatedTokenInfo = await new TokenInfoQuery()
        .setTokenId(tokenInfo.tokenId)
        .execute(client);
      
      const newSupply = updatedTokenInfo.totalSupply.toString();
      
      // Calculate readable amounts
      const decimals = tokenInfo.decimals;
      const readablePrevious = (parseInt(previousSupply) / Math.pow(10, decimals)).toLocaleString();
      const readableNew = (parseInt(newSupply) / Math.pow(10, decimals)).toLocaleString();
      const readableMinted = (additionalAmount / Math.pow(10, decimals)).toLocaleString();
      
      console.log(`  ✅ ${symbol} minting successful!`);
      console.log(`     - Previous: ${readablePrevious} ${symbol}`);
      console.log(`     - Minted: +${readableMinted} ${symbol}`);
      console.log(`     - New Total: ${readableNew} ${symbol}`);
      console.log("");
      
      mintResults.push({
        symbol,
        tokenId: tokenInfo.tokenId,
        previousSupply,
        newSupply,
        amountMinted: additionalAmount
      });
      
    } catch (error) {
      console.error(`❌ Error minting additional ${symbol}:`, error);
    }
  }
  
  // Update the test tokens file with new supply info
  const updatedTokensInfo = {
    ...testTokensInfo,
    lastMintDate: new Date().toISOString(),
    mintHistory: [
      ...(testTokensInfo.mintHistory || []),
      {
        date: new Date().toISOString(),
        results: mintResults
      }
    ]
  };
  
  fs.writeFileSync(testTokensPath, JSON.stringify(updatedTokensInfo, null, 2));
  
  console.log("🎉 ADDITIONAL MINTING COMPLETE!");
  console.log("===============================");
  console.log(`Successfully minted additional supply for ${mintResults.length} tokens`);
  
  console.log("\n💰 Updated Token Balances:");
  console.log(`Your account (${operatorId}) now has:`);
  mintResults.forEach(result => {
    const tokenData = testTokensInfo.tokens[result.symbol];
    const decimals = tokenData.decimals;
    const totalReadable = (parseInt(result.newSupply) / Math.pow(10, decimals)).toLocaleString();
    console.log(`  - ${totalReadable} ${result.symbol}`);
  });
  
  console.log("\n📊 Mint Summary:");
  mintResults.forEach(result => {
    const tokenData = testTokensInfo.tokens[result.symbol];
    const decimals = tokenData.decimals;
    const mintedReadable = (result.amountMinted / Math.pow(10, decimals)).toLocaleString();
    console.log(`  - ${result.symbol}: +${mintedReadable} (Token ID: ${result.tokenId})`);
  });
  
  console.log(`\nMint history saved to: ${testTokensPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  }); 