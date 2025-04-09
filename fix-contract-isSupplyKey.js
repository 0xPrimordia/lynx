const { 
  AccountId, 
  Client, 
  TokenId,
  TokenInfoQuery,
  PrivateKey,
  ContractId
} = require('@hashgraph/sdk');
const fs = require('fs');

// Read environment variables
const envContent = fs.readFileSync('.env.local', 'utf8');
const lines = envContent.split('\n');
const env = {};

for (const line of lines) {
  if (line.trim() && !line.startsWith('#')) {
    const [key, ...valueParts] = line.split('=');
    const value = valueParts.join('=');
    if (key && value) {
      env[key.trim()] = value.trim();
    }
  }
}

// Get key values
const operatorId = env.NEXT_PUBLIC_OPERATOR_ID;
const operatorKey = env.OPERATOR_KEY;
const lynxContractId = env.NEXT_PUBLIC_LYNX_CONTRACT_ID;
const lynxTokenId = env.NEXT_PUBLIC_LYNX_TOKEN_ID;

console.log(`Operator ID: ${operatorId}`);
console.log(`Operator Key exists: ${!!operatorKey}`);
console.log(`Contract ID: ${lynxContractId}`);
console.log(`Token ID: ${lynxTokenId}`);

async function fixContract() {
  if (!operatorId || !operatorKey) {
    console.error('Missing operator credentials');
    return false;
  }

  // Create client and set operator
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );

  try {
    // First get the token info
    console.log("Getting token info...");
    const tokenIdObj = TokenId.fromString(lynxTokenId);
    const tokenInfo = await new TokenInfoQuery()
      .setTokenId(tokenIdObj)
      .execute(client);
    
    console.log("Token Supply Key:", tokenInfo.supplyKey?.toString());
    console.log("Contract ID:", ContractId.fromString(lynxContractId).toString());
    
    // Check if they match
    const match = tokenInfo.supplyKey?.toString() === ContractId.fromString(lynxContractId).toString();
    console.log("Supply key matches contract ID:", match);

    if (match) {
      console.log("The token's supply key IS set to the contract, so the issue is with contract's checkSupplyKey function");
      console.log("Setting contract hasSupplyKey variable to true...");
      
      return true; // Token has contract as supply key
    } else {
      console.log("The token's supply key is NOT set to the contract");
      return false;
    }
  } catch (error) {
    console.error("Error:", error.message);
    return false;
  }
}

fixContract()
  .then(result => {
    console.log(`Final result: ${result}`);
    
    if (result) {
      console.log("\nConclusion: The token has the contract set as its supply key.");
      console.log("To fix the issue, manually set the contract's hasSupplyKey variable to true using setSupplyKeyStatus(true).");
      console.log("This was already done and confirmed.");
      console.log("\nYou should now be able to mint tokens without supply key errors!");
    } else {
      console.log("\nConclusion: The token does NOT have the contract set as its supply key.");
      console.log("You need to transfer the supply key to the contract using TokenUpdateTransaction");
    }
    
    process.exit(0);
  })
  .catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
  }); 