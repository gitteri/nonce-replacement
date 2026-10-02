// Mirrors solutions/vector/ts/lib/connection.ts's RPC endpoint choice, exposed to
// the browser via a NEXT_PUBLIC_-prefixed env var (Next.js only inlines env vars
// with that prefix into client bundles). Falls back to the public devnet RPC, which
// is heavily rate-limited — set NEXT_PUBLIC_DEVNET_RPC_URL to a private RPC
// (Helius/Triton/QuickNode) for a much better demo experience.
export const DEVNET_RPC_URL =
  process.env.NEXT_PUBLIC_DEVNET_RPC_URL ?? "https://api.devnet.solana.com";
