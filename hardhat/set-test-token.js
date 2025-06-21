const { Client, AccountId, PrivateKey, ContractExecuteTransaction, ContractFunctionParameters, ContractId, Hbar } = require('@hashgraph/sdk');
require('dotenv').config({ path: '../.env.local' });

async function main() {
  const client = Client.forTestnet();
  client.setOperator(
    AccountId.fromString(process.env.NEXT_PUBLIC_OPERATOR_ID),
    PrivateKey.fromString(process.env.OPERATOR_KEY)
  );
  
  const contractId = ContractId.fromString(process.env.NEXT_PUBLIC_SIMPLE_MINTER_ID);
  const tokenAddress = process.env.NEXT_PUBLIC_LYNX_TEST_TOKEN_EVM_ID;
  
  console.log('Setting token address in SimpleTokenMinter...');
  console.log('Contract:', contractId.toString());
  console.log('Token Address:', tokenAddress);
  
  const tx = await new ContractExecuteTransaction()
    .setContractId(contractId)
    .setGas(300000)
    .setFunction('setTokenAddress', new ContractFunctionParameters().addAddress(tokenAddress))
    .setMaxTransactionFee(new Hbar(10))
    .execute(client);
    
  const receipt = await tx.getReceipt(client);
  console.log('✅ Status:', receipt.status.toString());
  client.close();
}

main().catch(console.error);
