"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useWallet } from "../providers/WalletProvider";
import { TokenService, MintParams, TokenRatios } from "../services/tokenService";
import { toast } from "sonner";
import { vt323 } from "../fonts";
import { Card, CardBody, CardHeader, Divider, Input, Button, Spinner, Progress } from "@nextui-org/react";
import { MintForm } from '../components/MintForm';
import { TokenQueueProvider } from '../providers/TokenQueueProvider';
import TippyInfo from '../components/TippyInfo';
import { useMockData } from "../config/environment";
import { 
  AccountId, 
  ContractExecuteTransaction, 
  ContractFunctionParameters, 
  Hbar,
  TransferTransaction,
  TransactionId,
  Client,
  ContractId
} from "@hashgraph/sdk";
import { transactionToBase64String } from "@hashgraph/hedera-wallet-connect";
import WalletButton from '../components/WalletButton';

// Helper for converting Hedera accountId to EVM address format
const accountIdToEvmAddress = (accountId: string): string => {
  try {
    // Convert account ID to a zero-padded hex string
    const id = AccountId.fromString(accountId).toSolidityAddress();
    // Ensure it's properly formatted as a 0x-prefixed 40-character string
    return '0x' + id.replace('0x', '').padStart(40, '0');
  } catch (error) {
    console.error("Error converting account ID to EVM address:", error);
    // Return a fallback value for testing
    return '0x0000000000000000000000000000000000000000';
  }
};

export default function MintPage() {
  const { dAppConnector, accountId, isConnected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [lynxAmount, setLynxAmount] = useState<number>(0);
  const [tokenRatios, setTokenRatios] = useState<TokenRatios | null>(null);
  const [isLoadingRatios, setIsLoadingRatios] = useState(false);
  const [hbarRequired, setHbarRequired] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Array<{type: string, amount: string, status: string, time: string}>>([]);
  
  // Token balances
  const [balances, setBalances] = useState({
    hbar: 0,
    sauce: 0,
    clxy: 0,
    lynx: 0,
    isLoading: false
  });

  // Memoize the fetchTokenRatios function to use in useEffect
  const fetchTokenRatios = useCallback(async () => {
    if (!isConnected || !dAppConnector || !accountId) {
      return;
    }

    setIsLoadingRatios(true);
    try {
      const tokenService = new TokenService(dAppConnector, accountId);
      const ratios = await tokenService.getTokenRatios();
      setTokenRatios(ratios);
    } catch (error) {
      console.error("Error fetching token ratios:", error);
      toast.error("Failed to fetch token exchange ratios");
    } finally {
      setIsLoadingRatios(false);
    }
  }, [isConnected, dAppConnector, accountId]);

  // Memoize the fetch balances function
  const fetchBalances = useCallback(async () => {
    if (!isConnected || !dAppConnector || !accountId) {
      return;
    }

    setBalances(prev => ({ ...prev, isLoading: true }));
    try {
      if (useMockData) {
        // Only use mock data if explicitly configured for testing
        console.log("[DEBUG] Using mock balances (test mode)");
        setBalances({
          hbar: 1000000000, // 10 HBAR in tinybar
          sauce: 500,
          clxy: 200,
          lynx: 50,
          isLoading: false
        });
      } else {
        // Use real wallet balances
        console.log("[DEBUG] Fetching real balances from wallet");
        const tokenService = new TokenService(dAppConnector, accountId);
        const realBalances = await tokenService.getTokenBalances();
        setBalances({
          hbar: realBalances.hbar,
          sauce: realBalances.sauce,
          clxy: realBalances.clxy,
          lynx: realBalances.lynx,
          isLoading: false
        });
      }
    } catch (error) {
      console.error("Error fetching balances:", error);
      toast.error("Failed to fetch token balances");
      setBalances(prev => ({ ...prev, isLoading: false }));
    }
  }, [isConnected, dAppConnector, accountId]);

  // Memoize the calculateRequiredHBAR function to use in useEffect
  const calculateRequiredHBAR = useCallback(async () => {
    if (!isConnected || !dAppConnector || !accountId || lynxAmount <= 0) {
      return;
    }

    try {
      const tokenService = new TokenService(dAppConnector, accountId);
      const required = await tokenService.calculateRequiredHBAR(lynxAmount);
      setHbarRequired(required);
    } catch (error) {
      console.error("Error calculating required HBAR:", error);
      setHbarRequired(null);
    }
  }, [isConnected, dAppConnector, accountId, lynxAmount]);

  // Fetch token ratios when the page loads
  useEffect(() => {
    if (isConnected && dAppConnector && accountId) {
      fetchTokenRatios();
      fetchBalances();
    }
  }, [isConnected, dAppConnector, accountId, fetchTokenRatios, fetchBalances]);

  // Update HBAR required when lynx amount or token ratios change
  useEffect(() => {
    if (lynxAmount > 0 && isConnected && dAppConnector && accountId) {
      calculateRequiredHBAR();
    } else {
      setHbarRequired(null);
    }
  }, [lynxAmount, tokenRatios, isConnected, dAppConnector, accountId, calculateRequiredHBAR]);

  const handleLynxAmountChange = (value: string) => {
    const amount = parseFloat(value) || 0;
    setLynxAmount(amount);
  };

  const handleMint = async () => {
    if (!isConnected || !dAppConnector || !accountId) {
      toast.error("Please connect your wallet first");
      return;
    }

    if (lynxAmount <= 0) {
      toast.error("Please enter a valid LYNX amount");
      return;
    }

    setIsLoading(true);
    try {
      const tokenService = new TokenService(dAppConnector, accountId);
      
      // Get token ratios for display
      const ratios = await tokenService.getTokenRatios();
      const sauceRequired = lynxAmount * ratios.sauceRatio;
      const clxyRequired = lynxAmount * ratios.clxyRatio;
      const hbarRequired = lynxAmount * ratios.hbarRatio;
      
      // Clear any existing toasts
      toast.dismiss();
      
      // Inform the user about the multi-step process
      toast.info(
        `To mint ${lynxAmount} LYNX, you'll need to approve these tokens first:
        
        1. Approve ${sauceRequired} SAUCE tokens
        2. Approve ${clxyRequired} CLXY tokens
        3. Complete the mint with ${hbarRequired/100_000_000} HBAR
        
        Watch for wallet popups - you must approve EACH transaction.
        DO NOT dismiss any popups - they are required!`,
        { duration: 15000 }
      );
      
      console.log("[DEBUG] Starting real mint process for", lynxAmount, "LYNX tokens");
      console.log("[DEBUG] Required tokens:", {
        SAUCE: sauceRequired,
        CLXY: clxyRequired,
        HBAR: hbarRequired/100_000_000
      });
      
      // Execute the mint process
      const params: MintParams = { lynxAmount };

      const result = await tokenService.mintLynx(params);
      
      if (result.status === "error" || result.error) {
        console.log("[DEBUG] Mint error:", result.error);
        console.log("[DEBUG] Diagnostics:", result.diagnostics);
        throw result.error || new Error("Mint process failed");
      }
      
      const transactionIds = result.diagnostics?.transactionIds || [result.transactionId || 'unknown'];
      
      // Add transaction to history
      const now = new Date();
      const newTransaction = {
        type: "Mint LYNX",
        amount: `${lynxAmount} LYNX`,
        status: "Transactions Signed",
        time: now.toISOString().slice(0, 16).replace('T', ' ')
      };
      setTransactions([newTransaction, ...transactions]);
      
      // Update balances after successful mint
      fetchBalances();
      
      // Show success message with transaction count
      toast.success(
        `All ${transactionIds.length} transactions signed successfully! Your LYNX tokens will appear in your wallet soon.`,
        { duration: 10000 }
      );
      
      // Log transaction IDs
      console.log("Transaction IDs:", transactionIds);
    } catch (error) {
      console.error("Error in mint process:", error);
      
      // Provide useful error message based on the error type
      if (error instanceof Error) {
        if (error.message.includes("rejected") || error.message.includes("denied")) {
          toast.error("A transaction was rejected. You must approve all wallet popups to complete the mint process.");
        } else if (error.message.includes("insufficient")) {
          toast.error(
            "Insufficient balance. Make sure you have enough HBAR, SAUCE, and CLXY tokens.",
            { duration: 8000 }
          );
        } else if (error.message.includes("SAUCE")) {
          toast.error(
            "SAUCE token approval failed. Please check your wallet and try again.",
            { duration: 8000 }
          );
        } else if (error.message.includes("CLXY")) {
          toast.error(
            "CLXY token approval failed. Please check your wallet and try again.",
            { duration: 8000 }
          );
        } else {
          toast.error(error.message, { duration: 8000 });
        }
      } else {
        toast.error("Failed to complete minting process. See console for details.", { duration: 8000 });
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Convert tiny HBAR to HBAR with 8 decimal places
  const formatHbar = (tinyHbar: number) => {
    return (tinyHbar / 100_000_000).toFixed(8);
  };

  // Calculate the percentage of available balance vs required
  const calculateBalancePercentage = (available: number, required: number) => {
    if (required === 0 || available === 0) return 0;
    const percentage = (available / required) * 100;
    return Math.min(percentage, 100); // Cap at 100%
  };

  // Determine if user has sufficient balance
  const hasSufficientHbar = hbarRequired ? balances.hbar >= hbarRequired : true;
  const hasSufficientSauce = tokenRatios && lynxAmount > 0 ? balances.sauce >= (lynxAmount * tokenRatios.sauceRatio) : true;
  const hasSufficientClxy = tokenRatios && lynxAmount > 0 ? balances.clxy >= (lynxAmount * tokenRatios.clxyRatio) : true;

  // Re-implement the testTransaction function using the exact working pattern from lynxify
  const testTransaction = async () => {
    console.log("Test contract transaction initiated");
    
    try {
      if (!isConnected || !dAppConnector || !accountId) {
        console.error("Wallet not connected");
        toast.error("Wallet not connected");
        return;
      }
      
      console.log("Creating contract transaction for account:", accountId);
      
      // Convert the account ID to EVM format for the contract call
      const evmAddress = accountIdToEvmAddress(accountId);
      console.log("Converted account ID to EVM address:", evmAddress);
      
      // Create a client for testnet
      const client = Client.forTestnet();
      
      // Create a simple contract execute transaction
      const transaction = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString("0.0.1662")) // Using a known contract ID
        .setGas(100000)
        .setFunction("balanceOf", new ContractFunctionParameters().addAddress(evmAddress))
        .setTransactionId(TransactionId.generate(accountId))
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(client);
      
      console.log("Contract transaction created:", {
        id: transaction.transactionId?.toString() || "No ID",
        isFrozen: transaction.isFrozen()
      });
      
      // Convert to base64
      const base64Tx = transactionToBase64String(transaction);
      console.log("Contract transaction converted to base64, length:", base64Tx.length);
      
      // Send to wallet
      console.log("Sending contract transaction to wallet...");
      toast.loading("Sending contract transaction to wallet...");
      
      const response = await dAppConnector.signAndExecuteTransaction({
        transactionList: base64Tx,
        signerAccountId: accountId
      });
      
      toast.dismiss();
      console.log("Contract transaction response:", response);
      toast.success("Contract transaction completed successfully!");
      
    } catch (error) {
      toast.dismiss();
      console.error("Contract transaction error:", error);
      toast.error("Failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };
  
  const testSimpleTransaction = async () => {
    console.log("Ultra simple transfer test initiated");
    
    try {
      if (!isConnected || !dAppConnector || !accountId) {
        console.error("Wallet not connected");
        toast.error("Wallet not connected");
        return;
      }
      
      console.log("Creating ultra simple transaction for account:", accountId);
      
      // Create a client for testnet
      const client = Client.forTestnet();
      
      // Create the absolute simplest possible transaction
      // Just send 0.01 HBAR to the treasury account and back to self
      const transfer = new TransferTransaction()
        .addHbarTransfer(accountId, new Hbar(-0.01))
        .addHbarTransfer("0.0.2", new Hbar(0.01))
        .setTransactionId(TransactionId.generate(accountId))
        .freezeWith(client);
      
      const frozen = transfer.isFrozen();
      console.log("Transaction frozen status:", frozen);
      
      if (!frozen) {
        console.error("Transaction NOT frozen properly!");
        toast.error("Transaction freezing failed!");
        return;
      }
      
      // Convert to base64
      const base64Tx = transactionToBase64String(transfer);
      
      console.log("Simple transaction details:", {
        id: transfer.transactionId?.toString(),
        base64Length: base64Tx.length,
        frozen: transfer.isFrozen()
      });
      
      console.log("---> About to send transaction to wallet <---");
      console.log("Transaction base64 (first 100 chars):", base64Tx.substring(0, 100));
      
      // Send to wallet with loading toast
      toast.loading("Sending simple transaction to wallet...");
      
      console.log("Calling signAndExecuteTransaction with:", {
        signerAccountId: accountId,
        transactionListLength: base64Tx.length
      });
      
      const response = await dAppConnector.signAndExecuteTransaction({
        transactionList: base64Tx,
        signerAccountId: accountId
      });
      
      console.log("---> GOT RESPONSE FROM WALLET <---");
      console.log("Transaction response:", response);
      
      toast.dismiss();
      toast.success("Simple transaction completed successfully!");
      
    } catch (error) {
      toast.dismiss();
      console.error("---> TRANSACTION ERROR <---");
      console.error("Error details:", error);
      toast.error("Failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const testDocumentedTransaction = async () => {
    console.log("Testing with documented pattern - MATCHING transactionService.ts");
    
    try {
      if (!isConnected || !dAppConnector || !accountId) {
        console.error("Wallet not connected");
        toast.error("Wallet not connected");
        return;
      }
      
      // Create a client for testnet
      const client = Client.forTestnet();
      
      // Create transfer transaction 
      const transaction = new TransferTransaction()
        .addHbarTransfer(accountId, new Hbar(-0.01))
        .addHbarTransfer("0.0.2", new Hbar(0.01))
        .setTransactionId(TransactionId.generate(accountId))
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(client);
      
      console.log("Transaction created with pattern from transactionService.ts:", {
        id: transaction.transactionId?.toString(),
        isFrozen: transaction.isFrozen()
      });
      
      // Convert to base64 EXACTLY as done in transactionService.ts
      const txBytes = transaction.toBytes();
      const txBase64 = Buffer.from(txBytes).toString('base64');
      
      console.log("Transaction converted to base64 using Buffer.from().toString()");
      
      // Send to wallet
      console.log("Sending transaction to wallet EXACTLY as in transactionService.ts");
      toast.loading("Sending transaction to wallet...");
      
      const response = await dAppConnector.signAndExecuteTransaction({
        signerAccountId: accountId,
        transactionList: txBase64
      });
      
      console.log("Transaction response:", response);
      toast.dismiss();
      toast.success("Transaction successful!");
      
    } catch (error) {
      toast.dismiss();
      console.error("Transaction error:", error);
      toast.error("Failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };
  
  // Try using directly signer.signTransaction approach
  const testDirectSigning = async () => {
    console.log("Testing direct signing approach");
    
    try {
      if (!isConnected || !dAppConnector || !accountId) {
        console.error("Wallet not connected");
        toast.error("Wallet not connected");
        return;
      }
      
      // Get the signer directly
      console.log(`Getting signer for account: ${accountId}`);
      const signer = dAppConnector.getSigner(AccountId.fromString(accountId));
      
      if (!signer) {
        throw new Error("Failed to get signer");
      }
      
      console.log("Signer obtained:", {
        signerType: typeof signer,
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(signer))
      });
      
      // Create a client for testnet
      const client = Client.forTestnet();
      
      // Create a simple transfer transaction
      const transaction = new TransferTransaction()
        .addHbarTransfer(accountId, new Hbar(-0.01))
        .addHbarTransfer("0.0.2", new Hbar(0.01))
        .setTransactionId(TransactionId.generate(accountId))
        .setMaxTransactionFee(new Hbar(2))
        .setTransactionMemo("Test transaction using direct signing");
      
      console.log("Transaction created for direct signing");
      
      // Sign the transaction directly
      console.log("CALLING signer.signTransaction() DIRECTLY - WATCH FOR POPUP");
      toast.loading("Signing transaction...");
      
      const signedTx = await signer.signTransaction(transaction);
      
      console.log("Transaction signed successfully:", {
        hasSignedTx: !!signedTx,
        transactionId: signedTx?.transactionId?.toString()
      });
      
      toast.dismiss();
      toast.success("Transaction signed successfully!");
      
    } catch (error) {
      toast.dismiss();
      console.error("Direct signing error:", error);
      toast.error("Failed: " + (error instanceof Error ? error.message : "Unknown error"));
    }
  };

  const testUltraMinimal = async () => {
    try {
      if (!isConnected || !dAppConnector || !accountId) {
        toast.error("Wallet not connected");
        return;
      }
      
      toast.loading("Creating minimal transaction...");
      console.log("Creating ULTRA MINIMAL transaction");
      
      // Create the simplest possible transaction
      const client = Client.forTestnet();
      
      // Create a simple transaction - transfer to treasury and back to self
      let transaction = new TransferTransaction()
        .setTransactionId(TransactionId.generate(accountId))
        .addHbarTransfer(accountId, new Hbar(-0.01))
        .addHbarTransfer("0.0.2", new Hbar(0.01))
        .freezeWith(client);
      
      const txBase64 = Buffer.from(transaction.toBytes()).toString('base64');
      
      console.log("TX created and converted to base64:", {
        txId: transaction.transactionId?.toString(),
        frozen: transaction.isFrozen(),
        base64Length: txBase64.length
      });
      
      toast.dismiss();
      toast.loading("Opening HashPack...");
      
      // This is an absolute minimal implementation 
      console.log("SENDING TO HASHPACK - SHOULD SEE WALLET POPUP");
      
      try {
        // Try with array first
        console.log("Trying with array for transactionList");
        const result = await dAppConnector.signAndExecuteTransaction({
          signerAccountId: accountId,
          transactionList: [txBase64] as any // Force as any to bypass type checking
        });
        
        console.log("SUCCESS WITH ARRAY:", result);
        toast.dismiss();
        toast.success("Transaction successful with array!");
        return;
      } catch (arrayError) {
        console.error("Failed with array approach:", arrayError);
        
        try {
          // Try with string 
          console.log("Trying with string for transactionList");
          const result = await dAppConnector.signAndExecuteTransaction({
            signerAccountId: accountId,
            transactionList: txBase64
          });
          
          console.log("SUCCESS WITH STRING:", result);
          toast.dismiss();
          toast.success("Transaction successful with string!");
          return;
        } catch (stringError) {
          console.error("Failed with string approach:", stringError);
          throw stringError;
        }
      }
    } catch (error) {
      toast.dismiss();
      toast.error("Both transaction approaches failed");
      console.error("Transaction error:", error);
    }
  };

  const sendRawTransaction = async () => {
    console.log("=== OFFICIAL IMPLEMENTATION PATTERN DIRECTLY FROM HEDERA WC SDK ===");
    
    if (!isConnected || !dAppConnector || !accountId) {
      toast.error("Wallet not connected");
      return;
    }
    
    try {
      console.log("Creating raw transaction using official pattern");
      
      // Create transaction object
      const client = Client.forTestnet();
      
      // Create a standard transfer transaction
      const transaction = new TransferTransaction()
        .addHbarTransfer(accountId, Hbar.fromTinybars(-1000))
        .addHbarTransfer("0.0.2", Hbar.fromTinybars(1000))
        .setMaxTransactionFee(new Hbar(2))
        .setTransactionId(TransactionId.generate(accountId))
        .setNodeAccountIds([new AccountId(3)])
        .freezeWith(client);
      
      // Get the transaction bytes
      console.log("Getting transaction bytes");
      // Get the transaction bytes for signing
      const transactionBytes = transaction.toBytes();
      
      // Convert to base64 string
      const transactionToSign = Buffer.from(transactionBytes).toString('base64');
      
      console.log("Transaction prepared:", {
        accountId,
        transactionBytesLength: transactionBytes.length,
        base64Length: transactionToSign.length
      });
      
      // Log transaction details
      console.log("About to execute transaction - BEFORE WC CALL");
      
      // Use Wallet Connect to sign and execute
      const result = await dAppConnector.signAndExecuteTransaction({
        signerAccountId: accountId,
        transactionList: transactionToSign,
      });
      
      console.log("AFTER CALL - Transaction executed:", result);
      toast.success("Transaction completed successfully!");
      
    } catch (error) {
      console.error("Transaction execution error:", error);
      toast.error("Transaction failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const testWithWorkingCode = async () => {
    console.log("=== TESTING WITH DIRECT COPY OF WORKING CODE ===");
    
    try {
      if (!isConnected || !dAppConnector || !accountId) {
        toast.error("Wallet not connected");
        return;
      }
      
      // Create a client for testnet
      const client = Client.forTestnet();
      
      // Copy transaction creation EXACTLY from your approveToken method
      console.log("Creating transaction with EXACT code from approveToken method");
      
      // Step 1: Create the transaction
      const transaction = new ContractExecuteTransaction()
        .setContractId(ContractId.fromString("0.0.1662")) // Using a known contract ID
        .setGas(1000000)
        .setFunction(
          "balanceOf", 
          new ContractFunctionParameters()
            .addAddress(accountIdToEvmAddress(accountId))
        )
        .setTransactionId(TransactionId.generate(AccountId.fromString(accountId)))
        .setTransactionMemo(`Testing with working code`)
        .setMaxTransactionFee(new Hbar(2))
        .freezeWith(client);
      
      console.log("Transaction created and frozen");
      
      // Step 2: Convert to base64
      const txBytes = transaction.toBytes();
      const txBase64 = Buffer.from(txBytes).toString('base64');
      
      console.log("Transaction converted to base64");
      
      // Step 3: Send to wallet for signing and execution
      console.log("Sending transaction to wallet");
      toast.loading("Sending to wallet...");
      
      // CRITICAL: This is the EXACT code from your TransactionService
      const response = await dAppConnector.signAndExecuteTransaction({
        signerAccountId: accountId,
        transactionList: txBase64
      });
      
      console.log("Transaction response:", response);
      toast.dismiss();
      toast.success("Transaction executed successfully!");
      
    } catch (error) {
      toast.dismiss();
      console.error("Transaction error:", error);
      toast.error("Transaction failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const finalAttempt = async () => {
    console.log("=== FINAL ATTEMPT WITH TIMEOUT HANDLING ===");
    
    try {
      if (!isConnected || !dAppConnector || !accountId) {
        toast.error("Wallet not connected");
        return;
      }
      
      // Show that we're working
      toast.loading("Attempting direct signing...");
      
      // Create a client for testnet
      const client = Client.forTestnet();
      
      // Create a simple transfer transaction
      const transaction = new TransferTransaction()
        .addHbarTransfer(accountId, new Hbar(-0.01))
        .addHbarTransfer("0.0.2", new Hbar(0.01))
        .setTransactionId(TransactionId.generate(accountId))
        .freezeWith(client);
        
      console.log("Transaction created");
      
      // Here's the difference - get the signer and use it directly
      console.log("Getting signer directly");
      const signer = dAppConnector.getSigner(AccountId.fromString(accountId));
      
      if (!signer) {
        throw new Error("Failed to get signer");
      }
      
      console.log("Retrieved signer, calling signTransaction DIRECTLY");
      
      // Use a promise with timeout in case the call hangs
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error("Transaction signing timed out")), 5000);
      });
      
      try {
        // Race the promises
        const signedTx = await Promise.race([signer.signTransaction(transaction), timeoutPromise]);
        console.log("Transaction signed successfully:", signedTx);
        toast.dismiss();
        toast.success("Transaction signed successfully!");
      } catch (timeoutError) {
        console.error("Signing timed out:", timeoutError);
        toast.dismiss();
        toast.error("Transaction signing timed out - wallet not responding");
      }
      
    } catch (error) {
      toast.dismiss();
      console.error("Transaction error:", error);
      toast.error("Transaction failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  /**
   * The CORRECT way to execute a transaction in HashPack
   */
  const correctHashPackTransaction = async () => {
    console.log("=== HASHPACK TRANSACTION WITH CORRECT PATTERN ===");
    
    if (!isConnected || !dAppConnector || !accountId) {
      toast.error("Wallet not connected");
      return;
    }
    
    toast.loading("Preparing transaction...");
    
    try {
      // Here's the key difference - we need to get THE CLIENT FIRST
      // so the transaction is properly configured
      console.log("Creating client...");
      const client = Client.forTestnet();
      
      console.log("Creating transaction...");
      
      // The problem might be that we're using AccountId.fromString in some places
      // and directly using the string in others. Let's be consistent.
      const myAccountId = AccountId.fromString(accountId);
      
      // Create a simple transaction
      const transaction = new TransferTransaction()
        .addHbarTransfer(myAccountId, new Hbar(-0.01))
        .addHbarTransfer("0.0.2", new Hbar(0.01))
        .setTransactionId(TransactionId.generate(accountId))
        .freezeWith(client);
      
      if (!transaction.isFrozen()) {
        throw new Error("Transaction did not freeze properly");
      }
      
      console.log("Transaction created and properly frozen:", {
        id: transaction.transactionId?.toString(),
        frozen: transaction.isFrozen()
      });
      
      // This is the crucial part - using the SDK's built-in conversion method
      const txBase64 = transactionToBase64String(transaction);
      console.log("Transaction converted to base64 (length):", txBase64.length);
      
      toast.dismiss();
      toast.loading("Opening HashPack wallet...");
      
      console.log("Sending transaction to HashPack with correct parameters");
      console.log("AccountId:", accountId);
      
      // The key here is proper transaction preparation and freezing
      const response = await dAppConnector.signAndExecuteTransaction({
        signerAccountId: accountId, 
        transactionList: txBase64
      });
      
      console.log("Transaction complete with response:", response);
      toast.dismiss();
      toast.success("Transaction successful!");
      
    } catch (error) {
      console.error("Error executing transaction:", error);
      toast.dismiss();
      toast.error("Transaction failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const diagnoseWalletConnection = async () => {
    console.log("===== DIAGNOSING WALLET CONNECTION =====");
    
    if (!dAppConnector) {
      console.error("No dAppConnector available");
      toast.error("No wallet connection available");
      return;
    }
    
    try {
      // Check WalletConnect client
      const hasClient = !!dAppConnector.walletConnectClient;
      console.log("WalletConnect client exists:", hasClient);
      
      if (!hasClient || !dAppConnector.walletConnectClient) {
        console.error("WalletConnect client is missing");
        toast.error("WalletConnect client not found - reconnect wallet");
        return;
      }
      
      // Check sessions - handle potential undefined errors
      try {
        const sessions = dAppConnector.walletConnectClient.session.getAll();
        console.log("All sessions:", sessions);
        
        if (sessions.length === 0) {
          console.error("No active sessions found");
          toast.error("No active wallet sessions found - reconnect wallet");
          return;
        }
        
        // Check methods
        const topic = sessions[0].topic;
        console.log("Session topic:", topic);
      } catch (sessionError) {
        console.error("Error accessing sessions:", sessionError);
      }
      
      console.log("Connector methods:", Object.getOwnPropertyNames(dAppConnector));
      
      // Check pending requests - using a safer approach
      try {
        // Using any to bypass type checking since the structure may vary
        const walletClient = dAppConnector.walletConnectClient as any;
        if (walletClient.pendingRequests) {
          const pendingRequests = walletClient.pendingRequests.getAll();
          console.log("Pending requests:", pendingRequests);
        } else {
          console.log("No pendingRequests field found on wallet client");
        }
      } catch (requestsError) {
        console.error("Error checking pending requests:", requestsError);
      }
      
      // Check SignClient events
      console.log("Testing basic functionality");
      
      // Check if we can get a signer
      if (accountId) {
        try {
          const signer = dAppConnector.getSigner(AccountId.fromString(accountId));
          console.log("Signer available:", !!signer);
          if (signer) {
            console.log("Signer methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(signer)));
          }
        } catch (signerError) {
          console.error("Error getting signer:", signerError);
        }
      }
      
      toast.success("Diagnostics complete - check console log");
      
    } catch (error) {
      console.error("Diagnostic error:", error);
      toast.error("Diagnostics failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  const resetWalletConnection = async () => {
    console.log("===== RESETTING WALLET CONNECTION =====");
    
    if (!dAppConnector) {
      console.error("No dAppConnector available");
      toast.error("No wallet connection available");
      return;
    }
    
    try {
      toast.loading("Attempting to disconnect wallet...");
      
      // First check if we have active sessions
      if (dAppConnector.walletConnectClient) {
        try {
          const sessions = dAppConnector.walletConnectClient.session.getAll();
          console.log("Found sessions:", sessions.length);
          
          // Try to disconnect each session
          for (const session of sessions) {
            console.log(`Disconnecting session with topic: ${session.topic}`);
            try {
              await dAppConnector.disconnect(session.topic);
              console.log(`Successfully disconnected session: ${session.topic}`);
            } catch (disconnectError) {
              console.error(`Failed to disconnect session ${session.topic}:`, disconnectError);
            }
          }
        } catch (sessionError) {
          console.error("Error accessing sessions:", sessionError);
        }
      }
      
      toast.dismiss();
      toast.success("Disconnected from wallet. Please refresh the page and reconnect.");
      
    } catch (error) {
      toast.dismiss();
      console.error("Reset error:", error);
      toast.error("Reset failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  /**
   * The EXACT implementation as specified by user notes
   */
  const fixedTestTransaction = async () => {
    if (!dAppConnector || !accountId) {
      toast.error("Wallet not connected");
      return;
    }
    
    toast.loading("Executing test transaction...");
    
    try {
      console.log("=== EXECUTING TRANSACTION WITH EXACT IMPLEMENTATION ===");
      
      // 1. Create client (CRITICAL: do this FIRST)
      const client = Client.forTestnet();
      console.log("Client created");
      
      // 2. Parse account ID 
      const sender = AccountId.fromString(accountId);
      console.log("Account ID parsed:", sender.toString());
      
      // 3. Create transaction with proper structure
      const transaction = new TransferTransaction()
        .addHbarTransfer(sender, new Hbar(-0.01))
        .addHbarTransfer("0.0.2", new Hbar(0.01))
        .setTransactionId(TransactionId.generate(sender))
        .setMaxTransactionFee(new Hbar(1))
        .freezeWith(client);
      
      console.log("Transaction created with the following properties:");
      console.log("- Transaction ID:", transaction.transactionId?.toString());
      console.log("- Is Frozen:", transaction.isFrozen());
      
      // 4. Use ONLY this serialization method (not manual Buffer)
      const txBase64 = transactionToBase64String(transaction);
      console.log("Transaction converted to base64 with length:", txBase64.length);
      
      // 5. Call with EXACTLY these parameters 
      console.log("Sending transaction to HashPack wallet...");
      const response = await dAppConnector.signAndExecuteTransaction({
        signerAccountId: accountId,
        transactionList: txBase64
      });
      
      console.log("Transaction executed successfully:", response);
      toast.dismiss();
      toast.success("Transaction executed successfully!");
      
      return response;
      
    } catch (error) {
      console.error("Transaction execution error:", error);
      toast.dismiss();
      toast.error("Transaction execution failed: " + (error instanceof Error ? error.message : String(error)));
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold text-gray-800">Mint LYNX Tokens</h1>
          <WalletButton />
        </div>
        
        {/* Fixed implementation from user notes */}
        <div className="grid grid-cols-1 gap-4 mb-6">
          <button
            className="px-5 py-4 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:bg-gray-400 font-bold text-xl"
            onClick={fixedTestTransaction}
            disabled={!isConnected}
          >
            EXACT IMPLEMENTATION
          </button>
        </div>
        
        {/* Diagnostic tools */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            className="px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 font-bold"
            onClick={diagnoseWalletConnection}
            disabled={!isConnected}
          >
            DIAGNOSE WALLET
          </button>
          
          <button
            className="px-4 py-3 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 font-bold"
            onClick={resetWalletConnection}
            disabled={!isConnected}
          >
            DISCONNECT + RESET
          </button>
        </div>
        
        <div className="text-center mb-8 max-w-xl mx-auto">
          <p>
            Minting LYNX tokens requires three sequential transactions:
          </p>
          <ol className="text-left mt-4 ml-6 list-decimal">
            <li className="mb-2">SAUCE token approval</li>
            <li className="mb-2">CLXY token approval</li>
            <li className="mb-2">Final LYNX minting (requires HBAR)</li>
          </ol>
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            Each transaction will require approval in your HashPack wallet.
            Please complete each transaction before proceeding to the next.
          </p>
        </div>
      </div>
      
      <TokenQueueProvider>
        <MintForm />
      </TokenQueueProvider>
    </div>
  );
} 