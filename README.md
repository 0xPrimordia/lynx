# Lynx Token App

A Next.js application for minting and burning Lynx tokens on the Hedera network.

## Features

- Connect to Hedera wallets using WalletConnect
- Mint LYNX tokens by depositing required tokens
- Burn LYNX tokens to receive the underlying tokens back

## Deployment

This application is designed to work with a Hedera token contract. The contract IDs are:

- Contract ID: `0.0.5758264`
- LYNX Token ID: `0.0.5758713`

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn
- A WalletConnect Project ID from [WalletConnect Cloud](https://cloud.walletconnect.com/)

### Installation

1. Clone the repository
2. Install dependencies
   ```bash
   npm install
   ```
3. Create a `.env.local` file with your WalletConnect Project ID
   ```
   NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="YOUR_WALLETCONNECT_PROJECT_ID"
   ```
4. Start the development server
   ```bash
   npm run dev
   ```
5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Technology Stack

- **Frontend**: Next.js, React, TypeScript, TailwindCSS
- **Hedera Integration**: 
  - @hashgraph/hedera-wallet-connect
  - @hashgraph/sdk
  - WalletConnect

## Recent Updates

### Public Minting Support

The contract has been updated to enable public minting without requiring admin privileges:

- The `onlyAdmin` modifier was removed from the `mintTo` function in the `IndexTokenController` contract
- Transaction fees in `TokenService` were increased from 5 HBAR to 10 HBAR to ensure transactions have enough gas
- Scripts were updated to support the new permissions model:
  - `mint-token.ts` now works with any account that has sufficient deposits
  - Contract files in both `app/contracts` and `hardhat/contracts` are now synchronized

Users can now mint tokens directly through the UI as long as they have the required token deposits in the vault.

## Project Structure

- `/app` - Next.js application routes and pages
- `/app/providers` - Context providers including WalletProvider 
- `/app/components` - Reusable UI components
- `/app/services` - Service classes including TokenService
- `/lib` - Utility functions and helpers

## License

This project is licensed under the MIT License - see the LICENSE file for details.
