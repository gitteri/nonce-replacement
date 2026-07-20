// @solana/web3.js@3.0.0-rc.0's bundled output references a `__VERSION__`
// global that its own build tooling is supposed to inject at publish time;
// running the package directly under Node (no consuming bundler define
// step) leaves it unset, so `new Connection(...)` throws a bare
// ReferenceError. Define it ourselves before constructing a Connection.
(globalThis as unknown as { __VERSION__?: string }).__VERSION__ ??= "3.0.0-rc.0";

import { Connection } from "@solana/web3.js";

export const DEVNET_RPC_URL =
  process.env.DEVNET_RPC_URL ?? "https://api.devnet.solana.com";

export function devnetConnection(): Connection {
  return new Connection(DEVNET_RPC_URL, { commitment: "confirmed" });
}
