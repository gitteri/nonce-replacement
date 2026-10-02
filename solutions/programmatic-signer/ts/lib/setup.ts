import { generateKeyPairSigner, type Address, type KeyPairSigner } from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import type { Devnet } from "./connection.js";
import { generateColdKey } from "./keypair.js";
import {
  createNonceAccountInstructions,
  programmaticSigner,
  type ColdKey,
} from "./programmaticSigner.js";
import { sendTx } from "./sendTx.js";

export type SignerSetup = {
  cold: ColdKey;
  pda: Address;
  nonceAccounts: Address[];
  setupSignature: string;
};

/**
 * A fresh cold key with `nonceAccounts` nonce accounts under its programmatic signer, and the PDA
 * funded with `pdaLamports`. The relayer pays for all of it, the cold key signs nothing.
 */
export async function setupSigner(
  devnet: Devnet,
  relayer: KeyPairSigner,
  { nonceAccounts = 1, pdaLamports = 0n }: { nonceAccounts?: number; pdaLamports?: bigint } = {}
): Promise<SignerSetup> {
  const cold = await generateColdKey();
  const pda = await programmaticSigner(cold.address);
  const accounts = await Promise.all(Array.from({ length: nonceAccounts }, () => generateKeyPairSigner()));
  const instructions = [];
  for (const account of accounts) {
    instructions.push(...(await createNonceAccountInstructions(devnet.rpc, relayer, account, pda)));
  }
  if (pdaLamports > 0n) {
    instructions.push(
      getTransferSolInstruction({ source: relayer, destination: pda, amount: pdaLamports })
    );
  }
  const setupSignature = await sendTx(devnet, relayer, instructions);
  return { cold, pda, nonceAccounts: accounts.map((a) => a.address), setupSignature };
}
