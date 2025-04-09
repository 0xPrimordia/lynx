"use client";

import React, { useState } from "react";
import { useWallet } from "../providers/WalletProvider";
import { TokenService, BurnParams } from "../services/tokenService";
import { Button, Card, CardHeader, CardBody, Divider, Input } from "@nextui-org/react";
import { toast } from "sonner";
import { vt323 } from "../fonts";

export default function BurnPage() {
  const { dAppConnector, accountId, isConnected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [burnAmount, setBurnAmount] = useState<number>(0);

  const handleAmountChange = (value: string) => {
    setBurnAmount(parseInt(value) || 0);
  };

  const handleBurn = async () => {
    if (!isConnected || !dAppConnector || !accountId) {
      toast.error("Please connect your wallet first");
      return;
    }

    // Validate input
    if (burnAmount <= 0) {
      toast.error("Please enter a valid amount to burn");
      return;
    }

    setIsLoading(true);
    try {
      const tokenService = new TokenService(dAppConnector, accountId);
      const params: BurnParams = {
        lynxAmount: burnAmount,
      };

      const tx = await tokenService.burnLynx(params);
      
      toast.success("LYNX tokens burned successfully!");
      console.log("Transaction ID:", tx);
    } catch (error) {
      console.error("Error burning LYNX tokens:", error);
      toast.error("Failed to burn LYNX tokens");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="py-14 container mx-auto px-6">
      <div className="flex flex-col items-center text-center mb-12">
        <h1 className={`mb-6 ${vt323.className} terminal-cursor`} style={{ color: "#0159E0", fontSize: "2.6rem" }}>
          Lynxify Burn
        </h1>
      </div>

      <Card 
        className="max-w-4xl mx-auto bg-black" 
        shadow="none"
        classNames={{
          base: "bg-[#0A0A0A] rounded-lg",
          header: "px-6 pt-6",
          body: "px-6 py-6"
        }}
      >
        <CardHeader className="px-6 pt-6">
          <h2 className={`text-xl font-bold w-full ${vt323.className}`} style={{ color: "#0159E0" }}>Burn LYNX Tokens</h2>
        </CardHeader>
        <Divider />
        <CardBody className="px-6 py-6">
          <div className="grid md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <h3 className={`text-lg text-white mb-2 ${vt323.className}`}>Input</h3>
                <p className="text-gray-300 text-sm mb-2">
                  Amount of LYNX to burn
                </p>
              </div>
              
              <div className="bg-[#111] p-4 rounded-lg">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-white">LYNX</span>
                  <Input
                    type="text"
                    placeholder="0.00"
                    className="w-1/2 text-right bg-transparent"
                    classNames={{
                      input: "text-right text-white",
                      inputWrapper: "bg-transparent border-none"
                    }}
                    onChange={(e) => handleAmountChange(e.target.value)}
                  />
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-400">
                    Balance: 25 LYNX
                  </p>
                </div>
                <Button 
                  color="primary" 
                  className="w-full"
                  onClick={handleBurn}
                  isLoading={isLoading}
                  disabled={isLoading || !isConnected}
                >
                  {isLoading ? "Processing..." : "Burn LYNX Tokens"}
                </Button>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex flex-col gap-2">
                <h3 className={`text-lg text-white mb-2 ${vt323.className}`}>Output</h3>
                <p className="text-gray-300 text-sm mb-2">
                  Tokens you will receive
                </p>
              </div>
              
              <div className="bg-[#111] p-4 rounded-lg">
                <div className="space-y-4 mb-4">
                  <div className="flex justify-between items-center p-2 rounded-md bg-black">
                    <span className="text-white">HBAR</span>
                    <span className="text-white">0.00</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-md bg-black">
                    <span className="text-white">USDC</span>
                    <span className="text-white">0.00</span>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-400">
                    Current exchange ratio: 1 LYNX = 10 HBAR + 5 USDC
                  </p>
                </div>
                <Button 
                  color="default" 
                  className="w-full bg-[#222] text-gray-300"
                  disabled
                >
                  Estimated Returns
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-12">
            <h3 className={`text-lg text-white mb-4 ${vt323.className}`}>Transaction History</h3>
            <div className="overflow-x-auto bg-[#111] rounded-lg p-4">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#111]">
                    <th className="text-left p-3 text-gray-300">Transaction</th>
                    <th className="text-left p-3 text-gray-300">Amount</th>
                    <th className="text-left p-3 text-gray-300">Status</th>
                    <th className="text-left p-3 text-gray-300">Time</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[#111]">
                    <td className="p-3 text-white">Burn LYNX</td>
                    <td className="p-3 text-white">5 LYNX</td>
                    <td className="p-3">
                      <span className="text-emerald-400">Completed</span>
                    </td>
                    <td className="p-3 text-gray-300">2023-05-15 11:32</td>
                  </tr>
                  <tr className="border-b border-[#111]">
                    <td className="p-3 text-white">Withdraw HBAR</td>
                    <td className="p-3 text-white">50 HBAR</td>
                    <td className="p-3">
                      <span className="text-emerald-400">Completed</span>
                    </td>
                    <td className="p-3 text-gray-300">2023-05-15 11:33</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
} 