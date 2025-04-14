# Lynx Deployment Tools

This directory contains simplified deployment tools for the Lynx token system. These tools consolidate the deployment process into easy-to-use npm scripts.

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Check your environment**:
   ```bash
   npm run check-env
   ```
   This will verify that your `.env.local` file has all required variables and will check for any conflicts in deployment configuration.

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run check-env` | Checks environment variables and existing deployment |
| `npm run deploy:all` | Run the entire deployment process in one command |
| `npm run deploy` | Deploy the contracts only |
| `npm run fund` | Fund the controller contract with HBAR |
| `npm run create-token` | Create the token |
| `npm run verify` | Verify token deployment and update configuration |

## Typical Workflow

### Fresh Deployment

```bash
# 1. Check your environment
npm run check-env

# 2. Run the full deployment process
npm run deploy:all

# 3. Update your .env.local with the values from the verification output
# 4. Start your application
cd ..
npm run dev
```

### Updating Contracts

```bash
# 1. Make your changes to both contract files
#    - hardhat/contracts/index-token/*.sol
#    - app/contracts/*.sol

# 2. Deploy new contracts
npm run deploy

# 3. Fund the controller
npm run fund

# 4. Verify your deployment
npm run verify

# 5. Update your .env.local if needed and restart the app
```

## Troubleshooting

- **Environment check fails**: Make sure your `.env.local` file has all required variables
- **Deployment fails**: Check hardhat.config.ts for correct network settings
- **Token creation issues**: The controller can only create one token - use verify to check status
- **Private key format errors**: Our scripts try to handle both ED25519 and ECDSA key formats automatically

## Further Information

For more detailed information about the deployment process, check the [DEPLOYMENT.md](../DEPLOYMENT.md) file in the project root. 