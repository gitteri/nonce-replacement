import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import {
  airdropFactory,
  createKeyPairFromPrivateKeyBytes,
  createKeyPairSignerFromBytes,
  getAddressFromPublicKey,
  lamports,
  type KeyPairSigner,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import type { Devnet } from "./connection.js";
import type { ColdKey } from "./programmaticSigner.js";
import { sendTx } from "./sendTx.js";

/** A Solana CLI keypair file (64-byte JSON array: seed then public key), generated on first use. */
export async function loadOrGenerateKeypair(path: string): Promise<KeyPairSigner> {
  if (!existsSync(path)) {
    const seed = crypto.getRandomValues(new Uint8Array(32));
    const { publicKey } = await createKeyPairFromPrivateKeyBytes(seed, true);
    const publicBytes = new Uint8Array(await crypto.subtle.exportKey("raw", publicKey));
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify([...seed, ...publicBytes]));
  }
  const raw = JSON.parse(readFileSync(path, "utf8")) as number[];
  return createKeyPairSignerFromBytes(Uint8Array.from(raw));
}

/** The local Solana CLI identity, or `DEVNET_FUNDER_KEYPAIR_PATH`. */
export async function loadFunderKeypair(): Promise<KeyPairSigner> {
  const path =
    process.env.DEVNET_FUNDER_KEYPAIR_PATH ?? join(homedir(), ".config", "solana", "id.json");
  return loadOrGenerateKeypair(path);
}

/** A fresh cold key. It never pays or signs a transaction, only authorization messages. */
export async function generateColdKey(): Promise<ColdKey> {
  const keyPair = await createKeyPairFromPrivateKeyBytes(crypto.getRandomValues(new Uint8Array(32)));
  return { address: await getAddressFromPublicKey(keyPair.publicKey), keyPair };
}

/**
 * Tops `signer` up to `minLamports` with devnet airdrops, falling back to a transfer from `funder`
 * once the faucet's per-IP limit is hit.
 */
export async function ensureFunded(
  devnet: Devnet,
  signer: KeyPairSigner,
  minLamports: number,
  funder?: KeyPairSigner
): Promise<void> {
  const balance = async () => Number((await devnet.rpc.getBalance(signer.address).send()).value);
  const current = await balance();
  if (current >= minLamports) return;

  const airdrop = airdropFactory(devnet);
  for (const delayMs of funder ? [1000, 3000] : [1000, 3000, 8000, 15000, 30000]) {
    try {
      await airdrop({
        recipientAddress: signer.address,
        lamports: lamports(BigInt(minLamports - current)),
        commitment: "confirmed",
      });
      if ((await balance()) >= minLamports) return;
    } catch {
      // retry below
    }
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const afterAirdrop = await balance();
  if (afterAirdrop >= minLamports) return;
  if (!funder) {
    throw new Error(
      `Devnet airdrop for ${signer.address} did not land. Fund it at https://faucet.solana.com and re-run.`
    );
  }
  await sendTx(devnet, funder, [
    getTransferSolInstruction({
      source: funder,
      destination: signer.address,
      amount: BigInt(minLamports - afterAirdrop),
    }),
  ]);
}
