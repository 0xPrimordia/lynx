# Deployment Management System

This document outlines the deployment management system designed to prevent confusion around contract and token IDs.

## Problem Statement

The previous deployment process had several issues:
- **No centralized tracking** of deployed contracts and tokens
- **Inconsistent ID formats** (EVM vs Hedera format confusion)
- **No deployment verification** process
- **Environment variables scattered** without validation
- **Manual tracking** leading to lost or incorrect IDs

## Solution Overview

The new deployment management system provides:
1. **Centralized Registry** (`deployment-registry.json`)
2. **Automated Tracking** of all deployments
3. **Environment Generation** from registry
4. **Validation Scripts** to verify deployment status
5. **Consistent ID Management** (both EVM and Hedera formats)

## Files in the System

### Core Files
- `deployment-registry.json` - Central registry of all deployments
- `scripts/deployment-manager.ts` - Core deployment management class
- `scripts/deploy-and-track.ts` - Deployment script with tracking
- `scripts/validate-deployment.ts` - Validation script
- `scripts/setup-environment.ts` - Environment setup script

### Generated Files
- `.env.deployment` - Generated environment variables
- `.env.local` - Your local environment (manually updated)

## Usage

### 1. Check Current Status
```bash
npm run validate-deployment
```

This shows you:
- Which contracts are deployed and verified
- Which tokens exist and are verified
- Overall environment health

### 2. Fresh Deployment
```bash
npm run deploy-fresh
```

This will:
- Deploy IndexVault contract
- Deploy IndexTokenController contract
- Create LYNX token through the controller
- Record all IDs in the registry
- Verify deployments
- Generate environment file

### 3. Setup Environment
```bash
npm run setup-env
```

This will:
- Generate `.env.deployment` from registry
- Help you update `.env.local`
- Show you what variables need to be set

## Registry Structure

The `deployment-registry.json` file tracks:

```json
{
  "network": "testnet",
  "deployments": {
    "contracts": {
      "IndexVault": {
        "hederaId": "0.0.123456",
        "evmAddress": "0x1234...",
        "deployedAt": "2024-01-01T00:00:00.000Z",
        "verified": true,
        "abi": "path/to/abi.json"
      }
    },
    "tokens": {
      "LYNX": {
        "tokenId": "0.0.789012",
        "createdAt": "2024-01-01T00:00:00.000Z",
        "verified": true,
        "decimals": 8,
        "controller": "0.0.123456"
      }
    }
  }
}
```

## Environment Variables

The system generates these environment variables:

```bash
# Contract IDs (Hedera format)
NEXT_PUBLIC_LYNX_CONTRACT_HEDERA_ID=0.0.123456

# Token IDs
NEXT_PUBLIC_LYNX_TOKEN_ID=0.0.789012
NEXT_PUBLIC_SAUCE_TOKEN_ID=0.0.1183558
NEXT_PUBLIC_CLXY_TOKEN_ID=0.0.5365

# Vault Contract
NEXT_PUBLIC_VAULT_CONTRACT_ID=0.0.123457
```

## Best Practices

### Before Deploying
1. Always run `npm run validate-deployment` first
2. Backup your current `.env.local` if it exists
3. Ensure you have sufficient HBAR for deployment fees

### During Deployment
1. Use the tracked deployment script: `npm run deploy-fresh`
2. Don't manually edit the registry file
3. Let the system record all IDs automatically

### After Deployment
1. Run `npm run validate-deployment` to confirm success
2. Run `npm run setup-env` to update environment variables
3. Test the application with `npm run dev`

### When Things Go Wrong
1. Check the registry file for recorded deployments
2. Use `npm run validate-deployment` to see what's missing
3. If needed, start fresh with `npm run deploy-fresh`

## ID Format Conversion

The system handles both formats:
- **EVM Address**: `0x1234567890abcdef1234567890abcdef12345678`
- **Hedera ID**: `0.0.123456`

The deployment manager automatically converts between formats when needed.

## Troubleshooting

### "Contract not found" errors
- Check if contracts are deployed: `npm run validate-deployment`
- Redeploy if needed: `npm run deploy-fresh`

### "Token not associated" errors
- Verify token IDs in environment variables
- Check token decimals are correct (SAUCE/CLXY = 6, LYNX = 8)

### Environment variable issues
- Regenerate environment: `npm run setup-env`
- Compare `.env.deployment` with `.env.local`

## Migration from Old System

If you have existing deployments:
1. Run `npm run validate-deployment` to see current state
2. If everything shows "NOT_DEPLOYED", run `npm run deploy-fresh`
3. Update your `.env.local` with the new values from `.env.deployment`

This system ensures we never lose track of contract and token IDs again. 