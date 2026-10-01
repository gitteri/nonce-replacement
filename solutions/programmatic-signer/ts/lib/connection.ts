import { createSolanaRpc, createSolanaRpcSubscriptions } from "@solana/kit";

export const DEVNET_RPC_URL = process.env.DEVNET_RPC_URL ?? "https://api.devnet.solana.com";
export const DEVNET_WS_URL =
  process.env.DEVNET_WS_URL ?? DEVNET_RPC_URL.replace(/^http/, "ws");

export function devnetRpc() {
  return {
    rpc: createSolanaRpc(DEVNET_RPC_URL),
    rpcSubscriptions: createSolanaRpcSubscriptions(DEVNET_WS_URL),
  };
}

export type Devnet = ReturnType<typeof devnetRpc>;
