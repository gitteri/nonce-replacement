// Mirrors solutions/vector/ts/lib/connection.ts's RPC endpoint choice, exposed to
// the browser via SvelteKit's PUBLIC_-prefixed env var convention (the client bundle
// only inlines vars with that prefix). Falls back to the public devnet RPC, which
// is heavily rate-limited — set PUBLIC_DEVNET_RPC_URL to a private RPC
// (Helius/Triton/QuickNode) for a much better demo experience.
import { env } from '$env/dynamic/public';
import { Connection } from '@solana/web3.js';

export const DEVNET_RPC_URL = env.PUBLIC_DEVNET_RPC_URL ?? 'https://api.devnet.solana.com';

export const connection = new Connection(DEVNET_RPC_URL, { commitment: 'confirmed' });
