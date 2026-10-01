/**
 * Requirement 3 — Fee-Payer Separation (requirements/nonce-replacement-spec.md).
 *
 * The cold key has no SOL and never signs a transaction. It signs once offline, and the relayer
 * isn't part of the signed bytes, so whoever ends up broadcasting pays the fee. Here relayer B
 * lands a transaction that was signed before anyone picked a relayer.
 */
import { getTransferSolInstruction } from "@solana-program/system";
import { createNoopSigner } from "@solana/kit";
import { devnetRpc } from "../lib/connection.js";
import { ensureFunded, loadFunderKeypair, loadOrGenerateKeypair } from "../lib/keypair.js";
import { logTx, section } from "../lib/format.js";
import { fetchStoredNonce, presign } from "../lib/programmaticSigner.js";
import { sendTx } from "../lib/sendTx.js";
import { setupSigner } from "../lib/setup.js";

async function main() {
  const devnet = devnetRpc();
  const funder = await loadFunderKeypair();
  const setupPayer = await loadOrGenerateKeypair(".devnet/03-relayer-a.keypair.json");
  const relayer = await loadOrGenerateKeypair(".devnet/03-relayer-b.keypair.json");
  await ensureFunded(devnet, setupPayer, 0.006e9, funder);
  await ensureFunded(devnet, relayer, 0.001e9, funder);

  section("Setup, paid by relayer A");
  const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(devnet, setupPayer, {
    pdaLamports: 2_000_000n,
  });
  logTx("setup", setupSignature);
  const balance = async (address: typeof pda) => (await devnet.rpc.getBalance(address).send()).value;
  console.log(`cold key ${cold.address} balance: ${await balance(cold.address)} lamports`);

  section("Cold key signs offline, no relayer chosen yet");
  const nonce = await fetchStoredNonce(devnet.rpc, nonceAccounts[0]);
  const presigned = await presign(cold, nonceAccounts[0], nonce, [
    getTransferSolInstruction({
      source: createNoopSigner(pda),
      destination: setupPayer.address,
      amount: 1_000n,
    }),
  ]);
  console.log(`signed ${presigned.authorizationMessage.length} bytes, none of them a relayer key`);

  section("Relayer B lands it and pays the fee");
  const before = await balance(relayer.address);
  const signature = await sendTx(devnet, relayer, [presigned.submit]);
  logTx("submit (fee payer: relayer B)", signature);
  console.log(`relayer B paid ${before - (await balance(relayer.address))} lamports`);
  console.log(`cold key balance still ${await balance(cold.address)} lamports`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
