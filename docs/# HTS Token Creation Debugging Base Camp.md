# HTS Token Creation Debugging Base Camp

## Overview

This document serves as the central hub for debugging and resolving the issue encountered during the token creation step of the Lynx Index Token deployment process. The problem occurs when using the Hardhat task or script to create a token via the Hedera Token Service (HTS).

---

## Problem Statement

### Observed Behavior
- The token creation step fails with the following symptoms:
  - **Error Message**: `CONTRACT_REVERT_EXECUTED` or similar.
  - The transaction does not result in a valid token address being created.
  - The controller contract does not have the expected supply key or token address.
  - **Additional Symptom**: Transaction consistently uses exactly 4,000,000 gas (maxing out).
  - No revert reason is provided, just silent failure.
  - No events emitted despite multiple event declarations before potential failure points.

### Context
- The deployment process uses the `create.ts` script or the `token:create-with-contract` Hardhat task.
- The issue appears to be related to:
  1. **Gas Limit or Gas Price**: Potentially insufficient gas or incorrect gas price settings.
  2. **HTS Precompile Access**: The controller contract may not have proper access to the HTS precompile.
  3. **Account Permissions**: The deployer account may not have sufficient permissions or HBAR balance.
  4. **Contract State**: The controller contract may not be in the expected state (e.g., missing supply key).
  5. **Execution Path Divergence**: The transaction pattern suggests the code might be caught in a loop or hitting a computational limit rather than a simple parameter validation failure.

### Key Theories to Investigate
1. **Infinite Loop in Key Validation/Setup**
   - Investigate if the contract logic for key validation or setup is causing an infinite loop.
2. **Computational Complexity Issue in Array Handling**
   - Analyze if the handling of multiple key arrays (admin, supply, auto-renew) is leading to excessive computation.
3. **Gas Estimation vs. Actual Execution Path**
   - Determine if there is a mismatch between gas estimation and the actual execution path.
4. **HTS Precompile Interaction**
   - Check if the interaction with the HTS precompile (`0x167`) is triggering unexpected execution paths.
5. **Treasury Contract Setup**
   - Verify if setting the treasury to a vault contract address is contributing to the issue.

### Need to Determine
- Is this a fundamental computational complexity issue?
- Where exactly is the execution path diverging?
- How to add granular debugging without affecting gas estimation?
- Whether the issue lies in the contract logic or HTS precompile interaction?

---

## Analysis

### Key Areas to Investigate
1. **Gas Configuration**
   - Ensure the gas limit and gas price are sufficient for the token creation transaction.
   - Verify the gas settings in `hardhat.config.ts` and the `create.ts` script.

2. **HTS Precompile Access**
   - Confirm that the controller contract can interact with the HTS precompile (`0x0000000000000000000000000000000000000167`).
   - Use a minimal interface to test basic HTS functionality (e.g., `balanceOf`).

3. **Deployer Account**
   - Verify that the deployer account has sufficient HBAR balance (at least 10 HBAR recommended).
   - Ensure the deployer account is the same as the one used for contract deployment.

4. **Controller Contract State**
   - Check if the controller contract has the correct `ADMIN` and `supplyKey` values.
   - Verify that the `getTokenAddress` function returns the expected token address.

5. **Environment Variables**
   - Ensure `.env.local` contains the correct `NEXT_PUBLIC_OPERATOR_ID` and `OPERATOR_KEY`.
   - Verify that these values match the deployer account.

---

## Debugging Plan

### Step 1: Validate Gas Configuration
- **Action**: Update gas settings in `create.ts` to use a higher gas limit and gas price:
  ```typescript
  const tx = await controller.createIndexToken(name, symbol, memo, {
    value: ethers.parseEther("10.0"),
    gasLimit: 8000000, // Increase gas limit
    gasPrice: ethers.parseUnits("600", "gwei") // Ensure minimum 600 gwei
  });
  ```

## Advanced Debugging Plan

### Step 1: Analyze Contract Logic
- **Action**: Review the `IndexTokenController` contract to ensure:
  1. The `createIndexToken` function correctly interacts with the HTS precompile.
  2. The `onlyAdmin` modifier is not causing unintended reverts.
  3. The `getTokenAddress` function returns the expected address after token creation.
- **Expected Outcome**: The contract logic should align with HTS requirements and not contain errors.

### Step 2: Test HTS Precompile Edge Cases
- **Action**: Write a minimal script to test HTS precompile interactions directly:
  ```typescript
  const htsAddress = "0x0000000000000000000000000000000000000167";
  const htsInterface = new ethers.Interface([
    "function createToken(string memory name, string memory symbol, string memory memo) external returns (address)"
  ]);
  const htsContract = new ethers.Contract(htsAddress, htsInterface, deployer);

  try {
    const tokenAddress = await htsContract.createToken("Test Token", "TEST", "Test Memo");
    console.log("Token created at:", tokenAddress);
  } catch (err) {
    console.error("HTS precompile interaction failed:", err);
  }
  ```
- **Expected Outcome**: The HTS precompile should respond as expected, or provide detailed error information.

### Step 3: Investigate Network-Specific Issues
- **Action**: Check Hedera network status and known issues:
  1. Verify the network is not experiencing downtime or congestion.
  2. Consult Hedera documentation for any recent changes to HTS behavior.
- **Expected Outcome**: Confirm the network is functioning normally and supports the required HTS operations.

### Step 4: Debug Transaction Details
- **Action**: Analyze the transaction receipt and logs:
  ```typescript
  const receipt = await tx.wait();
  console.log("Transaction logs:", receipt.logs);
  ```
  - Look for specific revert reasons or unusual log entries.
- **Expected Outcome**: Identify the exact cause of the transaction failure.

### Step 5: Consult Hedera Support
- **Action**: If the issue persists, gather all relevant information (e.g., transaction hash, error logs, contract code) and contact Hedera support or community forums.
- **Expected Outcome**: Obtain insights or solutions from Hedera experts.

## Tactical Debugging Plan

### Step 1: Trace All Execution Paths
- **Action**: Insert logging events before and after each function call in the token creation process.
  - Add logs at the beginning of each major branch or loop.
  - Use `emit DebugCheckpoint` events to log gas remaining at critical points.
  ```solidity
  function checkpoint(string memory label) internal {
      emit DebugCheckpoint(label, gasleft());
  }

  event DebugCheckpoint(string label, uint256 gasRemaining);
  ```
  - Example usage:
  ```solidity
  checkpoint("Before HTS Precompile");
  callHTSPrecompile();
  checkpoint("After HTS Precompile");
  ```
- **Expected Outcome**: Identify where the execution path consumes all gas or fails silently.

### Step 2: Profile the Flow
- **Action**: Build a minimal reproducer for token creation:
  1. Test with only one key type at a time.
  2. Measure gas consumption incrementally with each added step.
  3. Create test cases with various key combinations.
- **Expected Outcome**: Narrow down the specific step or key combination causing the issue.

### Step 3: Isolate the HTS Precompile Call
- **Action**: Wrap the HTS precompile call (`0x167`) in its own function.
  - Pre-log inputs to the HTS call.
  - Post-log outputs or errors from the HTS call.
- **Expected Outcome**: Determine if the issue lies within the HTS precompile or the surrounding logic.

### Step 4: Test Theories
- **Action**: Conduct the following experiments:
  1. Use no keys (empty key array) to check for key validation loops.
  2. Use only the admin key to verify the base path correctness.
  3. Set the treasury to `address(this)` to eliminate the vault contract as a root cause.
  4. Use HTS from a different contract to rule out upstream contract interference.
  5. Deploy on a forked Hedera testnet to compare logs and behavior.
- **Expected Outcome**: Validate or eliminate potential root causes such as key setup, treasury interactions, or upstream interference.

### Step 5: Add Gas Burn Detectors
- **Action**: Use gas burn detectors to identify where gas is being consumed:
  ```solidity
  checkpoint("Before HTS Precompile");
  callHTSPrecompile();
  checkpoint("After HTS Precompile");
  ```
- **Expected Outcome**: Pinpoint the exact location where gas is consumed without progress.

### Step 6: Investigate Precompile Behavior
- **Action**: Test for potential precompile-native failures:
  1. Uninitialized or circular key setup.
  2. Misformatted `KeyValue` or `KeyList` for HTS.
  3. Unexpected interaction from vault/treasury fallback.
  4. Internal recursion within HTS due to bad data.
- **Expected Outcome**: Identify if the issue is caused by malformed data or unexpected precompile behavior.

### Step 7: Use Advanced Tools
- **Action**: Leverage the following tools for deeper insights:
  1. **Hardhat + Hedera Plugin**: For local dry runs.
  2. **Tenderly**: To simulate gas usage paths, even in failed transactions.
  3. **Ethers.js Gas Overrides**: To test with different gas limits:
     ```javascript
     await contract.createToken(...args, { gasLimit: 5000000 });
     ```
  4. Deploy a debug version of the contract with no actual `createToken` logic to verify flow up to the HTS call.
- **Expected Outcome**: Gain detailed insights into gas usage and execution paths.

### Step 8: Consult Hedera Support
- **Action**: If the issue persists, gather all relevant information (e.g., transaction hash, error logs, contract code) and contact Hedera support or community forums.
- **Expected Outcome**: Obtain insights or solutions from Hedera experts.