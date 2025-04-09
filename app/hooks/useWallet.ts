import { DAppConnector } from "@hashgraph/hedera-wallet-connect";
import { useWallet as useWalletProvider } from "../providers/WalletProvider";

export interface WalletAccount {
  accountId: string;
  network: string;
}

export interface UseWalletResult {
  connector: DAppConnector | null;
  account: WalletAccount | null;
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  isConnected: boolean;
  isConnecting: boolean;
  connect: () => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  error: Error | null;
}

export function useWallet(): UseWalletResult {
  // Get the wallet context from the provider
  const { 
    dAppConnector, 
    isInitializing, 
    isConnected, 
    accountId, 
    connectWallet, 
    disconnectWallet 
  } = useWalletProvider();

  // Map status from the context properties
  let status: 'disconnected' | 'connecting' | 'connected' | 'error' = 'disconnected';
  if (isInitializing) {
    status = 'connecting';
  } else if (isConnected) {
    status = 'connected';
  }

  // Create account object if we have an accountId
  const account: WalletAccount | null = accountId ? {
    accountId,
    network: 'testnet' // Assuming testnet as seen in WalletProvider.tsx
  } : null;

  // Wrap the connect and disconnect functions to return booleans
  const connect = async (): Promise<boolean> => {
    try {
      await connectWallet();
      return true;
    } catch (error) {
      console.error('Error connecting wallet:', error);
      return false;
    }
  };

  const disconnect = async (): Promise<boolean> => {
    try {
      await disconnectWallet();
      return true;
    } catch (error) {
      console.error('Error disconnecting wallet:', error);
      return false;
    }
  };

  return {
    connector: dAppConnector,
    account,
    status,
    isConnected,
    isConnecting: isInitializing,
    connect,
    disconnect,
    error: null // No error state in the WalletProvider currently
  };
}

export default useWallet; 