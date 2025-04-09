const { 
  AccountId, 
  Client, 
  TokenId,
  TransferTransaction,
  PrivateKey,
  TokenUpdateTransaction,
  ContractId,
  ContractExecuteTransaction
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

async function transferSupplyKey() {
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
    console.log(`Updating token ${lynxTokenId} to give supply key to contract ${lynxContractId}...`);
    
    // Convert IDs to proper format
    const tokenIdObj = TokenId.fromString(lynxTokenId);
    const contractIdObj = ContractId.fromString(lynxContractId);
    
    // Create token update transaction to update the supply key
    const transaction = new TokenUpdateTransaction()
      .setTokenId(tokenIdObj)
      .setSupplyKey(contractIdObj);
    
    // Submit the transaction
    console.log("Submitting transaction...");
    const response = await transaction.execute(client);
    
    // Get receipt to ensure success
    console.log("Getting receipt...");
    const receipt = await response.getReceipt(client);
    
    console.log(`Transaction status: ${receipt.status.toString()}`);
    
    if (receipt.status.toString() === "SUCCESS") {
      console.log(`✅ Successfully transferred supply key to contract ${lynxContractId}`);
      
      // Now call the contract's checkSupplyKey function to update its status
      console.log("Calling contract's checkSupplyKey function...");
      const contractCall = new ContractExecuteTransaction()
        .setContractId(contractIdObj)
        .setGas(100000)
        .setFunction("checkSupplyKey");
      
      const contractResponse = await contractCall.execute(client);
      const contractReceipt = await contractResponse.getReceipt(client);
      
      console.log(`Contract call status: ${contractReceipt.status.toString()}`);
      console.log("Supply key transfer complete!");
      
      return true;
    } else {
      console.error(`❌ Failed to transfer supply key. Status: ${receipt.status.toString()}`);
      return false;
    }
  } catch (error) {
    console.error("Error transferring supply key:", error.message);
    if (error.message.includes("INVALID_SIGNATURE")) {
      console.error("This error suggests the operator account doesn't have the admin key for the token.");
      console.error("You must use the account that created the token or has the admin key.");
    }
    return false;
  }
}

transferSupplyKey()
  .then(result => {
    console.log(`Final result: ${result}`);
    process.exit(0);
  })
  .catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
  }); 