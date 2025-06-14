"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { DAppConnector } from "@hashgraph/hedera-wallet-connect";
import { LedgerId } from "@hashgraph/sdk";
import { toast } from "sonner";
import { AccountId } from "@hashgraph/sdk";

interface WalletContextProps {
  dAppConnector: DAppConnector | null;
  isInitializing: boolean;
  isConnected: boolean;
  accountId: string | null;
  connectWallet: () => Promise<string | null>;
  disconnectWallet: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextProps>({
  dAppConnector: null,
  isInitializing: false,
  isConnected: false,
  accountId: null,
  connectWallet: async () => null,
  disconnectWallet: async () => {},
});

export const useWallet = () => useContext(WalletContext);

const PROJECT_ID = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "";
const METADATA = {
  name: "Lynx Token App",
  description: "Lynx Token App for interacting with Lynx token",
  url: typeof window !== "undefined" ? window.location.href : "",
  icons: ["https://app.lynxify.xyz/logo.png"],
};

export const WalletProvider = ({ children }: { children: React.ReactNode }) => {
  const [dAppConnector, setDAppConnector] = useState<DAppConnector | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [sessionTopic, setSessionTopic] = useState<string | null>(null);
  const initialized = React.useRef(false);
  
  useEffect(() => {
    const initWalletConnect = async () => {
      // Skip if already initializing or initialized
      if (initialized.current) return;
      initialized.current = true;
      
      console.log("[WALLET] Starting DAppConnector initialization");
      
      try {
        setIsInitializing(true);
        
        // Create DAppConnector with proper configuration
        const connector = new DAppConnector(
          METADATA,
          LedgerId.TESTNET,
          PROJECT_ID
        );

        console.log("[WALLET] DAppConnector instance created:", {
          constructor: connector.constructor.name,
          metadata: METADATA,
          network: "TESTNET",
          projectId: PROJECT_ID ? "Set" : "Not set"
        });

        // Initialize with a reasonable timeout
        console.log("[WALLET] Calling connector.init()");
        const initPromise = connector.init();
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(() => reject(new Error("Wallet initialization timed out")), 10000);
        });
        
        await Promise.race([initPromise, timeoutPromise]);
        console.log("[WALLET] connector.init() completed successfully");
        
        setDAppConnector(connector);
        
        console.log("[WALLET] DAppConnector initialized successfully", {
          isInitialized: !!connector,
          hasClient: !!connector?.walletConnectClient,
          walletConnectClientExists: typeof connector?.walletConnectClient !== 'undefined'
        });

        // Set up event handlers for session management
        if (connector.walletConnectClient) {
          console.log("[WALLET] WalletConnect client found, setting up event handlers");
          
          // Handle session establishment
          connector.walletConnectClient.on("session_proposal", () => {
            console.log("[WALLET] Session proposed");
          });
          
          // Handle session updates
          connector.walletConnectClient.on("session_update", ({ topic, params }) => {
            console.log("[WALLET] Session updated:", topic);
            if (topic === sessionTopic) {
              try {
                const namespace = Object.values(params.namespaces)[0];
                if (namespace?.accounts?.length) {
                  const accountIdString = namespace.accounts[0].split(':')[2];
                  setAccountId(accountIdString);
                }
              } catch (error) {
                console.error("[WALLET] Error updating session:", error);
              }
            }
          });
          
          // Handle disconnection events
          connector.walletConnectClient.on("session_delete", ({ topic }) => {
            console.log("[WALLET] Session deleted:", topic);
            if (topic === sessionTopic) {
              setIsConnected(false);
              setAccountId(null);
              setSessionTopic(null);
            }
          });
          
          connector.walletConnectClient.on("session_expire", ({ topic }) => {
            console.log("[WALLET] Session expired:", topic);
            if (topic === sessionTopic) {
              setIsConnected(false);
              setAccountId(null);
              setSessionTopic(null);
            }
          });
          
          // Try to restore existing session if available
          const sessions = connector.walletConnectClient.session.getAll();
          console.log("[WALLET] Found existing sessions:", sessions.length);
          
          if (sessions.length > 0) {
            const latestSession = sessions[sessions.length - 1];
            setSessionTopic(latestSession.topic);
            
            try {
              const namespace = Object.values(latestSession.namespaces)[0];
              console.log("[WALLET] Session namespace:", namespace);
              
              if (namespace?.accounts?.length) {
                const accountIdString = namespace.accounts[0].split(':')[2];
                setAccountId(accountIdString);
                setIsConnected(true);
                
                console.log("[WALLET] Restored session with account:", accountIdString);
                
                // Test signer availability immediately
                try {
                  const signer = connector.getSigner(AccountId.fromString(accountIdString));
                  console.log("[WALLET] Restored session signer test:", {
                    hasSigner: !!signer,
                    canSignTransaction: !!signer?.signTransaction,
                    signerMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(signer))
                  });
                } catch (signerError) {
                  console.error("[WALLET] Failed to get signer for restored session:", signerError);
                }
                
                toast.success(`Reconnected to account: ${accountIdString}`);
              }
            } catch (error) {
              console.error("[WALLET] Error restoring session:", error);
            }
          }
        }
      } catch (error) {
        console.error("[WALLET] Failed to initialize wallet connect:", error);
        toast.error("Failed to initialize wallet");
      } finally {
        setIsInitializing(false);
      }
    };

    initWalletConnect();
    
    // Clean up function
    return () => {
      // Reset initialization flag if the component unmounts
      initialized.current = false;
      
      // No need to explicitly disconnect on unmount - this would break persistence
      // Let WalletConnect handle its own session state
    };
  }, [sessionTopic]); // Include sessionTopic in dependency array

  // Properly handle page reloads - we don't need to disconnect
  // WalletConnect is designed to maintain session across page reloads
  
  const connectWallet = async (): Promise<string | null> => {
    if (!dAppConnector) {
      console.error("[WALLET] Wallet connector not initialized");
      toast.error("Wallet not initialized");
      return null;
    }
    
    try {
      console.log("[WALLET] Starting wallet connection process");
      
      // Log connection details
      console.log("[WALLET] Connector state before connection:", {
        isInitialized: !!dAppConnector,
        hasWalletConnectClient: !!dAppConnector?.walletConnectClient,
        existingSessions: dAppConnector.walletConnectClient?.session?.getAll()?.length || 0,
        methods: Object.getOwnPropertyNames(dAppConnector)
      });
      
      // This is the critical call that should open the HashPack popup
      console.log("[WALLET] Calling dAppConnector.openModal()");
      const session = await dAppConnector.openModal();
      console.log("[WALLET] dAppConnector.openModal() returned", session);
      
      setSessionTopic(session.topic);
      
      console.log("[WALLET] Session established:", {
        topic: session.topic,
        expiry: session.expiry,
        namespaces: Object.keys(session.namespaces),
        hederaNamespace: !!session.namespaces.hedera
      });
      
      // Extract account information from the session
      try {
        const namespace = Object.values(session.namespaces)[0];
        console.log("[WALLET] Session namespace:", namespace);
        
        if (namespace?.accounts?.length) {
          // Extract accountId from "hedera:testnet:0.0.XXXXX" format
          const accountIdString = namespace.accounts[0].split(':')[2];
          console.log("[WALLET] Connected account ID:", accountIdString);
          
          setAccountId(accountIdString);
          setIsConnected(true);
          
          // Diagnostics - test signer immediately
          try {
            console.log("[WALLET] Testing signer with accountId:", accountIdString);
            const signer = dAppConnector.getSigner(AccountId.fromString(accountIdString));
            
            console.log("[WALLET] New connection signer obtained:", {
              hasSigner: !!signer,
              signerType: typeof signer,
              canSignTransaction: typeof signer.signTransaction === 'function',
              signerMethods: Object.getOwnPropertyNames(Object.getPrototypeOf(signer || {}))
            });
            
            // Store account ID for reconnection
            localStorage.setItem('walletAccountId', accountIdString);
          } catch (signerError) {
            console.error("[WALLET] Failed to test signer after connection:", signerError);
          }
          
          toast.success(`Connected to account: ${accountIdString}`);
          return accountIdString;
        } else {
          console.error("[WALLET] No accounts found in session namespace");
          return null;
        }
      } catch (error) {
        console.error("[WALLET] Error extracting account ID from session:", error);
        toast.error("Failed to get account information");
        return null;
      }
    } catch (error) {
      console.error("[WALLET] Failed to connect wallet:", error);
      toast.error("Failed to connect wallet");
      return null;
    }
  };

  const disconnectWallet = async () => {
    if (!dAppConnector || !isConnected || !sessionTopic) {
      return;
    }

    try {
      await dAppConnector.disconnect(sessionTopic);
      setIsConnected(false);
      setAccountId(null);
      setSessionTopic(null);
      toast.info("Disconnected from wallet");
    } catch (error) {
      console.error("Failed to disconnect wallet:", error);
      toast.error("Failed to disconnect wallet");
    }
  };

  return (
    <WalletContext.Provider
      value={{
        dAppConnector,
        isInitializing,
        isConnected,
        accountId,
        connectWallet,
        disconnectWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}; 