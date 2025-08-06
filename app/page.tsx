"use client";

import Link from "next/link";
import { vt323 } from "./fonts";
import { Card, CardBody, CardFooter, CardHeader, Button, Divider } from "@nextui-org/react";

export default function Home() {
  return (
    <div className="py-14 container mx-auto px-6">
      <div className="flex flex-col items-center text-center mb-16">
        <h1 className={`mb-6 ${vt323.className} terminal-cursor`} style={{ color: "#0159E0", fontSize: "3rem" }}>
          Lynx Token
        </h1>
        <p className="text-base md:text-lg text-white max-w-2xl">
          Mint and burn LYNX tokens on the Hedera network
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        <Card 
          className="bg-black" 
          shadow="none"
          classNames={{
            base: "bg-[#0A0A0A] rounded-lg",
            header: "pb-0 pt-6 px-6",
            body: "py-6 px-6",
            footer: "py-5 px-6"
          }}
        >
          <CardHeader className="pb-0 pt-6 px-6">
            <h3 className={`text-2xl font-bold ${vt323.className}`} style={{ color: "#0159E0" }}>Mint Tokens</h3>
          </CardHeader>
          <CardBody className="py-6 px-6">
            <p className="text-white text-sm">
              Deposit tokens at the required ratio to mint LYNX tokens.
            </p>
          </CardBody>
          <Divider />
          <CardFooter className="py-5 px-6">
            <Button 
              as={Link} 
              href="/mint"
              color="primary"
              size="lg"
              className="w-full"
            >
              Go to Mint
            </Button>
          </CardFooter>
        </Card>

        <Card 
          className="bg-black" 
          shadow="none"
          classNames={{
            base: "bg-[#0A0A0A] rounded-lg",
            header: "pb-0 pt-6 px-6",
            body: "py-6 px-6",
            footer: "py-5 px-6"
          }}
        >
          <CardHeader className="pb-0 pt-6 px-6">
            <h3 className={`text-2xl font-bold ${vt323.className}`} style={{ color: "#0159E0" }}>Burn Tokens</h3>
          </CardHeader>
          <CardBody className="py-6 px-6">
            <p className="text-white text-sm">
              Burn LYNX tokens to receive the underlying tokens back at the current ratio.
            </p>
          </CardBody>
          <Divider />
          <CardFooter className="py-5 px-6">
            <Button
              as={Link}
              href="/burn"
              color="primary"
              size="lg"
              className="w-full"
            >
              Go to Burn
            </Button>
          </CardFooter>
        </Card>
      </div>

      <Card 
        className="max-w-3xl mx-auto mt-16 bg-black" 
        shadow="none"
        classNames={{
          base: "bg-[#0A0A0A] rounded-lg",
          header: "px-6 pt-6",
          body: "px-6 py-6",
          footer: "px-6 py-5"
        }}
      >
        <CardHeader className="px-6 pt-6">
          <h2 className={`text-2xl font-bold text-center w-full ${vt323.className}`} style={{ color: "#0159E0" }}>About Lynx Token</h2>
        </CardHeader>
        <CardBody className="px-6 py-6">
          <p className="mb-6 text-white text-sm">
            Lynx Token (LYNX) is a token on the Hedera network that represents a basket of other tokens.
          </p>
          
          <div className="p-5 bg-[#111] rounded-lg mb-4">
            <p className="mb-3 flex justify-between">
              <span className="text-gray-300">Token Contract:</span>
              <code style={{ color: "#0159E0" }}>{process.env.NEXT_PUBLIC_DEPOSIT_MINTER_V2_HEDERA_ID || '0.0.6213127'}</code>
            </p>
            <p className="flex justify-between">
              <span className="text-gray-300">LYNX Token ID:</span>
              <code style={{ color: "#0159E0" }}>{process.env.NEXT_PUBLIC_LYNX_TOKEN_ID || '0.0.6200902'}</code>
            </p>
          </div>
        </CardBody>
        <Divider />
        <CardFooter className="px-6 py-5">
          <p className="text-sm text-gray-400 mx-auto">
            Powered by Hedera Hashgraph technology
          </p>
        </CardFooter>
      </Card>
    </div>
  );
} 