import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProvider } from "./providers/WalletProvider";
import { ThemeProvider } from "./providers/ThemeProvider";
import { TokenQueueProvider } from "./providers/TokenQueueProvider";
import { Toaster } from "sonner";
import Header from "./components/Header";
import { vt323 } from "./fonts";
import NextUIProvider from "./providers/NextUIProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lynxify",
  description: "Mint and burn LYNX tokens on Hedera",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${vt323.variable}`}>
      <head>
        <style>{`
          a {
            text-decoration: none;
          }
        `}</style>
      </head>
      <body className={`${inter.className} min-h-screen bg-black text-white`}>
        <ThemeProvider>
          <NextUIProvider>
            <WalletProvider>
              <TokenQueueProvider>
                <Header />
                {children}
                <footer className="border-t border-[#111] py-6 text-center text-gray-400 text-sm mt-auto">
                  <div className="container">
                    &copy; {new Date().getFullYear()} Lynxify. All rights reserved.
                  </div>
                </footer>
                <Toaster 
                  richColors 
                  position="top-right" 
                  theme="dark" 
                  toastOptions={{
                    style: {
                      background: '#111',
                      color: 'white',
                      border: '1px solid #222',
                    },
                  }}
                />
              </TokenQueueProvider>
            </WalletProvider>
          </NextUIProvider>
        </ThemeProvider>
      </body>
    </html>
  );
} 