import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { Connection, Keypair, LAMPORTS_PER_SOL, SystemProgram, Transaction } from "@solana/web3.js";
import { sendTx } from "./sendTx.js";

export async function loadOrGenerateKeypair(path: string): Promise<Keypair> {
  if (existsSync(path)) {
    const raw = JSON.parse(readFileSync(path, "utf8")) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(raw));
  }
  const keypair = await Keypair.generate();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(Array.from(keypair.secretKey)));
  return keypair;
}

/**
 * The local Solana CLI identity (`solana-keygen` default path, or
 * `DEVNET_FUNDER_KEYPAIR_PATH`). Devnet's airdrop faucet is rate-limited per
 * IP, not per-address — when it's exhausted, {@link ensureFunded} falls back
 * to transferring from this already-funded identity instead of failing.
 */
export async function loadFunderKeypair(): Promise<Keypair> {
  const path =
    process.env.DEVNET_FUNDER_KEYPAIR_PATH ??
    join(homedir(), ".config", "solana", "id.json");
  return loadOrGenerateKeypair(path);
}

/**
 * Devnet faucets are flaky and rate-limited. Airdrop with retry/backoff; if
 * every attempt is exhausted, fall back to a transfer from `funder` (an
 * already-funded devnet keypair, e.g. {@link loadFunderKeypair}) when given,
 * otherwise fail with a clear pointer to the manual faucet.
 */
export async function ensureFunded(
  connection: Connection,
  keypair: Keypair,
  minLamports: number = 0.05 * LAMPORTS_PER_SOL,
  funder?: Keypair
): Promise<void> {
  const balance = Number(await connection.getBalance(keypair.address));
  if (balance >= minLamports) return;

  const needed = minLamports - balance;
  const delaysMs = funder ? [1000, 3000] : [1000, 3000, 8000, 15000, 30000];

  for (let attempt = 0; attempt < delaysMs.length; attempt++) {
    try {
      const signature = await connection.requestAirdrop(keypair.address, needed);
      await connection.confirmTransaction(signature, "confirmed");
      const newBalance = Number(await connection.getBalance(keypair.address));
      if (newBalance >= minLamports) return;
    } catch {
      // fall through to backoff/retry below
    }
    await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
  }

  const afterAirdrop = Number(await connection.getBalance(keypair.address));
  if (afterAirdrop >= minLamports) return;

  if (funder) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: funder.address,
        toPubkey: keypair.address,
        lamports: minLamports - afterAirdrop,
      })
    );
    await sendTx(connection, tx, [funder]);
    return;
  }

  throw new Error(
    `Devnet airdrop for ${keypair.address.toBase58()} did not land after retries ` +
      `and no funder was provided. Fund it manually at https://faucet.solana.com and re-run.`
  );
}
