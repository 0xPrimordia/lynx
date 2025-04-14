# Lynx Token System Deployment Guide

This document provides exact instructions for deploying the Lynx Index Token system on Hedera Testnet.

> **CRITICAL NOTE**: 
> 1. You MUST use the same account for both deployment and token creation. The deployment sets the deployer account as the ADMIN, and only the ADMIN can create tokens.
> 2. The hardhat scripts use ethers.getSigners() to get the account, while the SDK scripts use OPERATOR_ID/OPERATOR_KEY from .env.local. These must be the same account.
> 3. If you encounter "CONTRACT_REVERT_EXECUTED" errors during token creation, check that you're using the same account that deployed the contracts.

> **INSUFFICIENT FUNDS NOTE**: If you encounter "Insufficient funds for transfer" errors despite having HBAR in your account, this is because the high gas price (600 gwei) multiplied by the gas limit makes the total transaction cost too high. This can happen if:
> 1. The transaction is extremely expensive in terms of HBAR
> 2. Your account has HBAR but not enough for this specific deployment
> 
> **Solutions**:
> - Increase the HBAR in your testnet account significantly
> - Try deploying with a hardhat local network first to validate contracts

## Project Structure

```
/lynx/
├── .env.local                          # Environment variables
├── deployment-info.json                # Deployment tracking
├── app/                                # Next.js frontend
│   └── contracts/                      # Contract copies for app
├── scripts/                            # Project-level scripts
│   ├── check-token-address.ts          # Checks and updates token address in deployment info
│   ├── check-token-status.ts           # Checks if token exists and has supply key
│   ├── deposit-assets.ts               # Simulates deposits for testing
│   ├── fund-contract.ts                # Funds controller with HBAR
│   ├── mint-token.ts                   # Script to mint tokens
│   ├── setup-vault-composition.ts      # Sets up vault composition
│   └── deploy-public-minting.ts        # Deploys contracts with public minting
├── hardhat/                            # Hardhat project
│   ├── contracts/                      # Contract source code
│   │   └── index-token/
│   ├── scripts/                        # Deployment scripts
│   │   ├── deploy/
│   │   │   └── index-token-system.ts   # Deploys both contracts
│   │   └── token/
│   │       ├── fund-hedera.ts          # Funds the controller
│   │       ├── create-token-hedera.ts  # Creates the token
│   │       └── verify-hedera.ts        # Checks deployment
│   └── hardhat.config.ts               # Hardhat configuration
```

## Key Features

This system supports **public minting** of index tokens. Any user can mint tokens by depositing the required assets in the vault, without requiring admin permission. This democratizes access to the index and enables a truly decentralized experience.

## Preparation Steps

### 1. Set up environment variables

Create or edit `.env.local` in the project root:

```
NEXT_PUBLIC_OPERATOR_ID=0.0.xxxxx     # Your testnet account ID
OPERATOR_KEY=xxxxx                    # Your private key
HEDERA_TESTNET_ENDPOINT=https://testnet.hashio.io/api
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=xxxxx
```

### 2. Check gas price settings

Edit `hardhat/hardhat.config.ts` and ensure the gas price is set correctly:

```typescript
networks: {
  hederaTestnet: {
    url: process.env.HEDERA_TESTNET_ENDPOINT || "https://testnet.hashio.io/api",
    accounts: [operatorKey],
    chainId: 296,
    gasPrice: 600000000000 // 600 gwei - minimum required
  }
}
```

### 3. Check deployment scripts

Edit `hardhat/scripts/deploy/index-token-system.ts` to ensure gas parameters are appropriate:

```typescript
const vault = await IndexVault.deploy(
  deployer.address,
  HTS_PRECOMPILE,
  {
    gasLimit: 500000,
    gasPrice: ethers.parseUnits("600", "gwei") // 600 gwei
  }
);

// ... and similarly for other transactions in the file
```

## Deployment Process

### Step 1: Navigate to the hardhat directory

```bash
cd hardhat
```

### Step 2: Deploy Contracts

```bash
npx hardhat run scripts/deploy/index-token-system.ts --network hederaTestnet
```

Expected output (successful):
```
Using operator account: 0.0.xxxxx
Deploying contracts with account: 0x...
1. Deploying IndexVault...
Waiting for vault deployment...
IndexVault deployed to: 0x...
2. Deploying IndexTokenController...
Waiting for controller deployment...
IndexTokenController deployed to: 0x...
3. Setting controller in vault...
Controller set in vault successfully
Deployment summary:
VaultId: 0.0.xxxxx
ControllerId: 0.0.xxxxx
Deployment info saved to deployment-info.json
```

### Step 3: Fund the Controller

Fix the private key format in `hardhat/scripts/token/fund-hedera.ts` before running:

```typescript
// Find this line:
client.setOperator(
  AccountId.fromString(operatorId),
  PrivateKey.fromStringECDSA(operatorKey) // Change this
);

// Change to:
client.setOperator(
  AccountId.fromString(operatorId), 
  PrivateKey.fromString(operatorKey) // Generic format works for all key types
);
```

Then run:

```bash
cd hardhat
npx ts-node scripts/token/fund-hedera.ts
```

Alternatively, you can use the simpler script from the project root:

```bash
npm run build
node scripts/fund-contract.js
```

### Step 4: Create Token

⚠️ **IMPORTANT**: You must use the same account for token creation that you used for contract deployment. The contract sets the deployer as the ADMIN, and only the ADMIN can create tokens.

Use the Hardhat task for token creation, which is more reliable and provides better debugging information:

```bash
cd hardhat
npx hardhat token:create-with-contract --controller 0.0.xxxxx --name "Lynx Index Token" --symbol "LYNX" --memo "Lynx Index Token"
```

Replace `0.0.xxxxx` with your actual controller contract ID from the deployment-info.json file.

Alternatively, you can use the script approach (less recommended):

```bash
cd hardhat
npx hardhat run scripts/token/create.ts --network hederaTestnet
```

Expected output (successful):
```
Creating token using controller 0.0.xxxxx:
- Name: Lynx Index Token
- Symbol: LYNX
- Memo: Lynx Index Token

Checking if token already exists...
No existing token found. Proceeding with creation.
Transaction ID: 0.0.xxxxx@1234567890.123456789
Creation status: SUCCESS
Token was successfully created!
This token supports public minting - any user with sufficient deposits can mint tokens.
Updated deployment-info.json with token address
Controller has supply key: true
```

If you encounter errors during token creation:
1. Make sure you're using the same account that deployed the contracts
2. Ensure the controller has enough HBAR (at least 5 HBAR)
3. Verify the contract parameters are correct
4. Try using the `create-token-debug` task for more detailed error information:
   ```bash
   npx hardhat create-token-debug --network hederaTestnet
   ```

### Step 5: Verify Deployment

Fix the private key format in `hardhat/scripts/token/verify-hedera.ts` as shown above, then run:

```bash
cd hardhat
npx ts-node scripts/token/verify-hedera.ts
```

Alternatively, you can use the simpler verification scripts:

```bash
node scripts/check-token-status.js
node scripts/check-token-address.js
```

This will output the token ID and other details to add to your `.env.local` file.

### Step 6: Set Up Vault Composition

Set up the token composition in the vault:

```bash
node scripts/setup-vault-composition.js
```

This script defines which tokens are part of the index and their weights (default is 50% SAUCE, 50% CLXY).

### Step 7: Update Environment Variables

Update your `.env.local` with values from the verification output:

```
NEXT_PUBLIC_LYNX_CONTRACT_ID=0.0.xxxxx
NEXT_PUBLIC_LYNX_TOKEN_ID=0.0.xxxxx  
NEXT_PUBLIC_VAULT_ID=0.0.xxxxx
```

### Step 8: Start the Application

The `npm run dev` command should be run from the project root (not the hardhat directory):

```bash
cd ..  # Go back to project root if in hardhat directory
npm run dev
```

If this fails with "Missing script: dev", check your package.json to ensure it has the correct scripts. You may need to add:

```json
"scripts": {
  "dev": "next dev",
  ...
}
```

## Public Minting

With the updated contracts, users can now mint tokens directly without admin intervention:

1. Users must deposit the required assets into the vault
2. Once deposits are verified, users can call the mint function directly
3. The system calculates the appropriate amount of tokens based on the composition

To test the minting process, you can use:

```bash
node scripts/mint-token.js
```

## Troubleshooting

### Gas Price Errors

If you see this error:
```
Error in deployment: Gas price '...' is below configured minimum gas price '600000000000'
```

Solution: Update both the hardhat.config.ts AND the deploy script to use at least 600 gwei.

### Private Key Format Issues

If transactions fail with INVALID_SIGNATURE:

Solution: Change `PrivateKey.fromStringECDSA(operatorKey)` to `PrivateKey.fromString(operatorKey)` in all scripts.

### Contract Reverts

If token creation fails with CONTRACT_REVERT_EXECUTED:

Solutions:
1. Check if token already exists using the verify script
2. Ensure the controller has enough HBAR (at least 5 HBAR)
3. Check controller and vault IDs in deployment-info.json are different

### Missing npm run dev

If "npm run dev" fails:

Solutions:
1. Ensure you're in the project root directory
2. Check that package.json has a "dev" script
3. If missing, you may need to run Next.js directly:
   ```bash
   npx next dev
   ```

### Transaction Fees

If transactions are failing with "INSUFFICIENT_TX_FEE":

Solution: The Lynx token service has been updated to use a maximum transaction fee of 10 HBAR for token operations (previously 5 HBAR). This should resolve most transaction fee issues on the testnet.

## After Deployment

### Updating Contracts

If you need to update contracts:

1. Update both versions of the contract:
   - `hardhat/contracts/index-token/*.sol`
   - `app/contracts/*.sol`

2. Recompile and redeploy:
   ```bash
   cd hardhat
   npx hardhat compile
   npx hardhat run scripts/deploy/index-token-system.ts --network hederaTestnet
   ```

3. Re-fund and verify:
   ```bash
   npx ts-node scripts/token/fund-hedera.ts
   npx ts-node scripts/token/create-token-hedera.ts
   npx ts-node scripts/token/verify-hedera.ts
   ```

## Using Hardhat Tasks

Hardhat tasks provide a more structured and reliable way to interact with the contracts compared to scripts. The following tasks are available and recommended:

### Token Creation and Management

```bash
# Create a token using the controller contract
npx hardhat token:create-with-contract --controller 0.0.xxxxx --name "Lynx Index Token" --symbol "LYNX" --memo "Token memo"

# Debug token creation issues
npx hardhat create-token-debug --network hederaTestnet

# Check accounts and balances
npx hardhat accounts --network hederaTestnet
```

### Recommended Script to Task Migrations

For better reliability and consistency, consider converting these scripts to Hardhat tasks:

1. **Fund Controller**: Create a task for funding the controller with HBAR
   ```bash
   # Current script:
   npx ts-node scripts/token/fund-hedera.ts
   
   # Could be a task:
   npx hardhat token:fund-controller --amount 10 --network hederaTestnet
   ```

2. **Token Verification**: Create a task for verifying token status
   ```bash
   # Current script:
   npx ts-node scripts/token/verify-hedera.ts
   
   # Could be a task:
   npx hardhat token:verify --network hederaTestnet
   ```

3. **Vault Composition Setup**: Create a task for setting up vault composition
   ```bash
   # Current script:
   node scripts/setup-vault-composition.js
   
   # Could be a task:
   npx hardhat vault:setup-composition --network hederaTestnet
   ```

These tasks can be implemented by creating new files in the `hardhat/tasks` directory and registering them in `hardhat.config.ts`.