import { address, type Address } from "@solana/kit";
import { Keypair, PublicKey, SystemProgram, type Connection } from "@solana/web3.js";
import { sendV1 } from "../vector/send";
import type { WalletStore } from "../wallet.svelte";
import { toV1Instruction } from "./bridge";
import {
  decodeStoredNonce,
  generateColdKey,
  initializeNonceInstruction,
  NONCE_ACCOUNT_SPACE,
  programmaticSigner,
  type ColdKey,
  type ProgramIds,
} from "./signer";

/** Program ids missing or not executable on the connected cluster. */
export async function missingPrograms(connection: Connection, ids: ProgramIds): Promise<Address[]> {
  const all = [ids.signer, ids.executor, ids.nonce];
  const infos = await connection.getMultipleAccountsInfo(all.map((id) => new PublicKey(id)));
  return all.filter((_, i) => !infos[i]?.executable);
}

export type SignerSetup = {
  cold: ColdKey;
  pda: Address;
  nonceAccounts: Address[];
  setupSignature: string;
};

/**
 * A fresh cold key with `nonceAccounts` nonce accounts under its programmatic signer, and the
 * PDA funded with `pdaLamports`. The wallet pays for all of it, the cold key signs nothing.
 */
export async function setupSigner(
  connection: Connection,
  wallet: WalletStore,
  ids: ProgramIds,
  { nonceAccounts = 1, pdaLamports = 0 }: { nonceAccounts?: number; pdaLamports?: number } = {}
): Promise<SignerSetup> {
  const payer = wallet.publicKey;
  if (!payer) throw new Error("Wallet not connected");
  const cold = generateColdKey();
  const pda = await programmaticSigner(ids, cold.address);
  const accounts = Array.from({ length: nonceAccounts }, () => Keypair.generate());
  const rent = await connection.getMinimumBalanceForRentExemption(NONCE_ACCOUNT_SPACE);

  const instructions = accounts.flatMap((account) => [
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: account.publicKey,
      lamports: rent,
      space: NONCE_ACCOUNT_SPACE,
      programId: new PublicKey(ids.nonce),
    }),
    toV1Instruction(initializeNonceInstruction(ids, address(account.publicKey.toBase58()), pda)),
  ]);
  if (pdaLamports > 0) {
    instructions.push(
      SystemProgram.transfer({ fromPubkey: payer, toPubkey: new PublicKey(pda), lamports: pdaLamports })
    );
  }
  const setupSignature = await sendV1(connection, wallet, instructions, accounts);
  return {
    cold,
    pda,
    nonceAccounts: accounts.map((a) => address(a.publicKey.toBase58())),
    setupSignature,
  };
}

export async function fetchStoredNonce(connection: Connection, nonceAccount: Address): Promise<Address> {
  const info = await connection.getAccountInfo(new PublicKey(nonceAccount));
  if (!info) throw new Error(`Nonce account ${nonceAccount} not found`);
  return decodeStoredNonce(new Uint8Array(info.data));
}
