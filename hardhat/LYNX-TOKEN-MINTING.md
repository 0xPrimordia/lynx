# Lynx Token Minting System

## Overview

This document outlines the implementation of the Lynx token minting system, which uses a flexible token composition approach to create an index token backed by a basket of other tokens.

## Architecture

The system consists of three main components:

1. **IndexVault**: Stores deposited tokens and manages the token composition
2. **IndexTokenController**: Handles token creation and minting operations
3. **Governance Hook (Future)**: Will enable DAO-based governance of the system

The architecture uses a hybrid approach for token creation (SDK) and management (smart contracts).

## Key Features

1. **Flexible Token Composition**
   - Dynamic configuration of tokens and their weights in the index
   - Ability to add, remove, or update tokens in the composition
   - Weights can be adjusted to represent the desired portfolio allocation

2. **User-Driven Minting**
   - Users deposit required tokens based on the composition
   - The system verifies sufficient deposits and calculates the correct mint amount
   - Upon successful validation, Lynx tokens are minted and sent to the user

3. **Governance-Ready**
   - Admin functions with hooks for future DAO governance integration
   - Parameters can be adjusted without code changes

## Implementation Details

### Token Composition Configuration

The system stores a list of tokens and their weights:

```solidity
// In IndexVault
address[] public compositionTokens;
mapping(address => bool) public isCompositionToken;
mapping(address => uint256) public tokenWeights;
uint256 public totalWeight = 0;
```

Weights represent the proportion of each token in the index. For example:
- SAUCE: 50% (weight: 50)
- CLXY: 50% (weight: 50)

### Deposit Process

1. Users check required deposit amounts:
   ```javascript
   const requiredDeposits = await controller.calculateRequiredDeposits(mintAmount);
   ```

2. They deposit tokens to the vault:
   ```javascript
   await vault.depositToken(tokenAddress, depositAmount);
   ```

3. The system tracks user deposits for each token:
   ```solidity
   userDeposits[msg.sender][_token] += _amount;
   ```

### Minting Process

1. User initiates minting:
   ```javascript
   await controller.mintWithDeposits(mintAmount);
   ```

2. The controller validates deposits:
   ```solidity
   bool hasDeposits = vault.validateMint(msg.sender, amount);
   ```

3. If valid, it processes the deposits:
   ```solidity
   vault.processMint(msg.sender, amount);
   ```

4. It mints Lynx tokens and transfers to the user:
   ```solidity
   hts.mintToken(INDEX_TOKEN, amount, metadata);
   hts.transferToken(INDEX_TOKEN, address(this), msg.sender, amount);
   ```

## Setup Process

The setup involves:

1. Deploying the contracts:
   ```
   npx hardhat run scripts/deploy/index-token-system.ts --network hederaTestnet
   ```

2. Setting up token composition:
   ```
   npx hardhat run scripts/setup-token-composition.ts --network hederaTestnet
   ```

3. Testing the minting flow:
   ```
   npx hardhat run scripts/test-mint-with-deposits.ts --network hederaTestnet
   ```

## Future Enhancements

1. **DAO Governance Integration**
   - Token holders can vote on composition changes
   - Utilizes the governance hook interface

2. **Price Oracle Integration**
   - Dynamic pricing for tokens in the composition
   - Automatic rebalancing based on market values

3. **Fee Mechanisms**
   - Mint/redeem fees for protocol sustainability
   - Yield-generating strategies for basket assets

## Conclusion

The Lynx Token Minting System provides a flexible framework for creating and managing an index token with a composable basket of assets. The architecture allows for future governance control while enabling immediate functionality with a hybrid token creation approach. 