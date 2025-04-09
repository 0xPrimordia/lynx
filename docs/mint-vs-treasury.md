
# 📦 Minting vs Treasury Contract Responsibilities

## Overview

This document defines the **division of responsibilities** between the `MintingContract` (also known as `IndexTokenController`) and the `TreasuryContract` (also known as `IndexVault`) in a decentralized, DAO-ready token minting system on Hedera.

---

## 🎯 Key Principle

**MintingContract** = controls token creation, supply key  
**TreasuryContract** = owns token reserves, enforces composition logic

---

## 🔍 Responsibility Matrix

| Functionality                                 | MintingContract ✅ | TreasuryContract ✅ |
|----------------------------------------------|--------------------|----------------------|
| Deploys the Index Token                       | ✅                 | ❌                   |
| Holds Supply Key                              | ✅                 | ❌                   |
| Holds Treasury Role (token custody)           | ❌                 | ✅                   |
| Token Balance Custody                         | ❌                 | ✅                   |
| Defines Composition (assets, weights)         | ❌                 | ✅                   |
| Accepts Backing Asset Deposits                | ❌                 | ✅                   |
| Verifies Supplied Asset Ratios                | ❌                 | ✅                   |
| Mints Index Token                             | ✅ (via HTS)       | ❌                   |
| Calls Treasury to Distribute Minted Tokens    | ✅                 | ✅                   |
| DAO Hooks: Update Ratios, Pause Minting, etc. | ❌                 | ✅                   |

---

## 🧱 Call Flow: Minting a Token

### 1. User prepares deposit:
- Sends appropriate backing tokens to the `TreasuryContract`.

### 2. User requests mint:
```solidity
mintTo(user, amount)
```
- Called on `MintingContract`

### 3. MintingContract actions:
- Calls:
  ```solidity
  Treasury.validateMint(user, amount)
  ```
- If true, then:
  - Calls `hts.mintToken(...)` for `amount`
  - Calls:
    ```solidity
    Treasury.receiveMint(user, amount)
    ```

### 4. TreasuryContract:
- Transfers newly minted index tokens from its own balance to the user

---

## 🧩 Composition Example Struct

```solidity
struct Asset {
    address token;
    uint16 weight; // in basis points (e.g., 5000 = 50%)
}
Asset[] public composition;
```

---

## 🔐 Why This Separation?

- **Modularity**: Update composition logic independently
- **Governability**: DAO controls treasury without touching mint logic
- **Security**: Prevent bypassing index rules
- **Upgradeability**: Treasury can evolve or be swapped

---

## 📁 Save As:
`mint-vs-treasury.md`
