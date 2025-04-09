"use client";

import React from "react";
import { useWallet } from "../providers/WalletProvider";
import { Button } from "@nextui-org/react";

const ConnectWallet: React.FC = () => {
  const { isConnected, accountId, connectWallet, disconnectWallet, isInitializing } = useWallet();

  if (isInitializing) {
    return (
      <Button 
        isLoading
        variant="bordered"
        size="sm"
        style={{
          backgroundColor: "#111",
          color: "#808080",
          borderColor: "#333",
          fontWeight: "500",
          height: "32px",
          fontSize: "14px",
          borderRadius: "8px",
          padding: "0 12px",
          minWidth: "unset"
        }}
        className="mt-0 shadow-sm transition-colors"
      >
        Initializing
      </Button>
    );
  }

  if (isConnected && accountId) {
    return (
      <Button
        onClick={disconnectWallet}
        variant="bordered"
        size="sm"
        style={{
          backgroundColor: "transparent",
          color: "white",
          borderColor: "#333",
          fontWeight: "500",
          height: "32px",
          fontSize: "14px",
          borderRadius: "8px",
          padding: "0 12px",
          minWidth: "unset"
        }}
        className="mt-0 shadow-sm hover:bg-gray-800 hover:border-gray-700 transition-colors"
      >
        {accountId.length > 12 ? `${accountId.substring(0, 6)}...${accountId.substring(accountId.length - 6)}` : accountId}
      </Button>
    );
  }

  return (
    <Button
      onClick={connectWallet}
      variant="bordered"
      size="sm"
      style={{
        backgroundColor: "#0159E0",
        color: "white",
        borderColor: "#0159E0",
        fontWeight: "500",
        height: "32px",
        fontSize: "14px",
        borderRadius: "8px",
        padding: "0 12px",
        minWidth: "unset"
      }}
      className="mt-0 shadow-sm hover:bg-blue-700 hover:border-blue-700 transition-colors"
    >
      Connect Wallet
    </Button>
  );
};

export default ConnectWallet; 