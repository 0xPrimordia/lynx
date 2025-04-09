
# 🧠 Hedera Token Minting MVP Plan (Cursor Compatible)

## Goal
Implement an MVP token minting system using Hedera Smart Contracts that is:
- Fully on-chain
- DAO-ready (but excludes DAO logic for now)
- Uses HTS precompile for token creation & minting
- Uses a **dedicated Treasury Contract** for custody and distribution

---

## 🏗️ Architecture

```
+------------------+         +--------------------+
| MintingContract  | <-----> | TreasuryContract   |
+------------------+         +--------------------+
       |                             |
       |                             |
       v                             v
  HTS Precompile               Holds tokens
  - create token               - transfer to users
  - mint token
```

---

## 📦 Contracts Breakdown

### 1. MintingContract
- Deploys and creates the token via HTS precompile
- Sets `supplyKey = self`, `treasury = TreasuryContract`
- Stores token ID on-chain
- Has `mintTo(user, amount)` method to mint and request transfer to user

### 2. TreasuryContract
- Accepts token as treasury during token creation
- Holds full token balance
- Receives mint requests only from MintingContract
- Transfers newly minted tokens to users

---

## 🔐 Security Considerations
- `MintingContract` is the only address allowed to call `Treasury.receiveMint()`
- Minting is disabled until `tokenCreated = true`
- Treasury has no external mint authority

---

## 🔧 Precompile Usage
- **HTS Precompile Address**: `0x167`
- Used for:
  - `createFungibleToken(...)`
  - `mintToken(...)`
  - `transferToken(...)`

---

## 🧪 Deployment Steps
1. Deploy `TreasuryContract` with `mintingContract = <future MintingContract>, token = address(0)`
2. Deploy `MintingContract`, passing `TreasuryContract` address
3. Call `createToken(...)` from MintingContract
4. Store returned token ID in both contracts
5. Fund MintingContract with HBAR for token creation gas
6. Call `mintTo(user, amount)` to mint and send tokens

---

## 🧩 Next Steps (Future)
- DAO integration via HCS
- Oracle/relayer to verify HCS proposals on-chain
- Multi-sig Treasury upgrade pattern
- User token association via HTS precompile

---

## 📁 File Name Suggestion
Save this as `plan-hedera-minting.md` in Cursor

