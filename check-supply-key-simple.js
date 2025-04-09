const { 
  AccountId, 
  Client, 
  ContractCallQuery, 
  ContractId, 
  PrivateKey
} = require('@hashgraph/sdk');
const fs = require('fs');

// Configuration
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
const operatorId = env.NEXT_PUBLIC_OPERATOR_ID; // "0.0.4340026"
const operatorKey = env.OPERATOR_KEY; // "c7fa62a9803edf904b38875b02ac4679c4832487bb1dc143ed768ad6d9811d46"
const contractId = env.NEXT_PUBLIC_LYNX_CONTRACT_ID; // "0.0.5758264"

console.log(`Operator ID: ${operatorId}`);
console.log(`Operator Key exists: ${!!operatorKey}`);
console.log(`Contract ID: ${contractId}`);

async function main() {
  // Create client and set operator
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(operatorId),
    PrivateKey.fromString(operatorKey)
  );

  // Create the query
  const query = new ContractCallQuery()
    .setContractId(ContractId.fromString(contractId))
    .setGas(100000)
    .setFunction("hasSupplyKey");

  try {
    console.log("Executing query...");
    const response = await query.execute(client);
    console.log("Got response");
    
    // Parse the result
    const hasSupplyKey = response.getBool(0);
    console.log(`Contract has supply key: ${hasSupplyKey}`);
    return hasSupplyKey;
  } catch (error) {
    console.error("Error:", error.message);
    
    if (error.message.includes("INVALID_SOLIDITY_ADDRESS")) {
      console.error("Invalid solidity address - check that the contract ID is correct");
    } else if (error.message.includes("INVALID_CONTRACT_ID")) {
      console.error("Invalid contract ID");
    } else if (error.message.includes("function selector was not found")) {
      console.error("The function 'hasSupplyKey' doesn't exist on this contract");
      
      // Try alternative function
      try {
        console.log("Trying alternative function 'checkSupplyKey'...");
        const query2 = new ContractCallQuery()
          .setContractId(ContractId.fromString(contractId))
          .setGas(100000)
          .setFunction("checkSupplyKey");
        
        await query2.execute(client);
        console.log("Check supply key query executed successfully");
        return true;
      } catch (error2) {
        console.error("Error with alternative function:", error2.message);
      }
    }
    
    return false;
  }
}

main()
  .then(result => {
    console.log(`Final result: ${result}`);
    process.exit(0);
  })
  .catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
  }); 