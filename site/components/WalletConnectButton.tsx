"use client";

import dynamic from "next/dynamic";

export const WalletConnectButton = dynamic(
  async () => (await import("@solana/wallet-adapter-react-ui")).WalletMultiButton,
  { ssr: false }
);
