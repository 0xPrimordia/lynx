"use client";

import React from "react";
import { useWallet } from "../providers/WalletProvider";

export default function WalletButton() {
  const { isConnected, accountId, connectWallet, disconnectWallet } = useWallet();

  return (
    <button
      onClick={isConnected ? disconnectWallet : connectWallet}
      className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
    >
      {isConnected ? `Disconnect (${accountId?.slice(0, 8)}...)` : "Connect Wallet"}
    </button>
  );
} 