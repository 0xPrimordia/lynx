# 📦 Index Token System

This document provides an overview of the Index Token System, which consists of two main contracts:

1. **IndexTokenController** - Handles token creation and minting
2. **IndexVault** - Manages token custody and composition logic

## 🏗️ Architecture

```
+------------------+         +--------------------+
| IndexToken       | <-----> | IndexVault         |
| Controller       |         |                    |
+------------------+         +--------------------+
       |                             |
       |                             |
       v                             v
  HTS Precompile               Holds tokens
  - create token               - transfer to users
  - mint token                 - custody deposits
```

## 🔑 Key Concepts

- **Separation of Concerns**: The token controller handles token creation and minting, while the vault handles token custody and composition logic.
- **Treasury Role**: The vault acts as the treasury for the index token, holding all minted tokens until they are distributed to users.
- **Supply Key**: The controller retains the supply key for the token, allowing it to mint new tokens.
- **Backing Assets**: Users deposit backing assets into the vault to mint index tokens.
- **Composition**: The vault defines the composition of the index token, specifying the required backing assets and their weights.

## 🤝 Contract Interactions

### Token Creation Flow

1. Deploy IndexVault
2. Deploy IndexTokenController with reference to IndexVault
3. Update IndexVault's controller reference
4. Create token via IndexTokenController
5. IndexTokenController informs IndexVault about the token

### Minting Flow

1. User deposits backing assets into IndexVault
2. User requests minting via IndexTokenController
3. IndexTokenController verifies deposits with IndexVault
4. If verified, IndexTokenController mints tokens to IndexVault
5. IndexVault transfers tokens to user and consumes deposits

## 🧰 Contract Details

### IndexTokenController

**Key Functions:**
- `createIndexToken(string name, string symbol, string memo)`: Creates the index token
- `mintTo(address recipient, uint256 amount)`: Mints tokens for a user
- `calculateRequiredDeposits(uint256 amount)`: Returns required deposit amounts

**State Variables:**
- `INDEX_TOKEN`: Address of the index token
- `hasSupplyKey`: Whether the contract has the supply key
- `vault`: Reference to the IndexVault

### IndexVault

**Key Functions:**
- `setComposition(Asset[] calldata _composition)`: Sets the token composition
- `validateMint(address user, uint256 amount)`: Validates if a user can mint
- `receiveMint(address user, uint256 amount)`: Distributes minted tokens
- `depositAsset(address token, uint256 amount)`: Accepts deposits

**State Variables:**
- `indexToken`: Address of the index token
- `controller`: Address of the controller contract
- `composition`: Array of assets and their weights
- `deposits`: Mapping of user deposits

## 📋 Usage Instructions

### Deployment

```bash
# Deploy the system
npm run deploy-index-system

# Set up token composition
npm run setup-composition

# Test token minting
npm run test-mint-index
```

### Configuration

Update your `.env.local` file with the following values after deployment:

```
# Contract Addresses
INDEX_CONTROLLER_ID=0.0.XXXXX
INDEX_VAULT_ID=0.0.XXXXX
INDEX_TOKEN_ID=0.0.XXXXX

# Composition Tokens
NEXT_PUBLIC_SAUCE_TOKEN_ID=0.0.XXXXX
NEXT_PUBLIC_CLXY_TOKEN_ID=0.0.XXXXX
```

## 🔒 Security Considerations

- Only the controller can mint tokens
- Only the vault can distribute tokens
- The vault validates deposits before distributing tokens
- Only admin can update composition

## 🧩 Future Enhancements

- DAO integration for governance
- Dynamic composition updates
- Fee structures
- Burning and redemption functionality 