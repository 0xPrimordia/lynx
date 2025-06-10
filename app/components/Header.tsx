"use client";

import React from "react";
import Link from "next/link";
import ConnectWallet from "./ConnectWallet";
import { vt323 } from "../fonts";

const Header: React.FC = () => {
  return (
    <header style={{ 
      backgroundColor: "black", 
      padding: "20px",
      width: "100%",
      boxSizing: "border-box",
      borderBottom: "1px solid #111"
    }}>
      <div style={{ 
        display: "flex", 
        justifyContent: "space-between", 
        alignItems: "center", 
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box"
      }}>
        {/* Logo */}
        <div>
          <Link href="/" style={{ textDecoration: "none", cursor: "pointer" }}>
            <span className="box">
              <h1 
                style={{
                  fontSize: "2.5rem",
                  color: "#0159E0",
                  fontWeight: "bold",
                  margin: 0,
                  padding: 0
                }}
                className={vt323.className}
              >
                Lynxify
              </h1>
            </span>
          </Link>
        </div>
        
        {/* Navigation */}
        <div style={{ display: "flex", gap: "32px" }}>
          <Link 
            href="/mint" 
            style={{
              fontSize: "24px",
              color: "white",
              textDecoration: "none",
              transition: "color 0.2s",
              fontWeight: "500"
            }}
            className={vt323.className}
          >
            Mint
          </Link>
          <Link 
            href="/burn" 
            style={{
              fontSize: "24px",
              color: "white",
              textDecoration: "none",
              transition: "color 0.2s",
              fontWeight: "500"
            }}
            className={vt323.className}
          >
            Burn
          </Link>
          <Link 
            href="/governance" 
            style={{
              fontSize: "24px",
              color: "white",
              textDecoration: "none",
              transition: "color 0.2s",
              fontWeight: "500"
            }}
            className={vt323.className}
          >
            Governance
          </Link>
        </div>
        
        {/* Connect Wallet */}
        <div>
          <ConnectWallet />
        </div>
      </div>
    </header>
  );
};

export default Header; 