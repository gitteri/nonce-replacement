/**
 * Requirement 5 — Selective Revocation (requirements/nonce-replacement-spec.md).
 *
 * The cold key pre-signs a payload on nonce account A, then signs and lands an empty-payload
 * Execute at the same nonce. That advances A with a different commitment, so the payload can no
 * longer land. A payload outstanding on nonce account B is untouched.
 */
import { getTransferSolInstruction } from "@solana-program/system";
import { createNoopSigner } from "@solana/kit";
import { devnetRpc } from "../lib/connection.js";
import { ensureFunded, loadFunderKeypair, loadOrGenerateKeypair } from "../lib/keypair.js";
import { firstLine, logTx, section } from "../lib/format.js";
import { fetchStoredNonce, presign } from "../lib/programmaticSigner.js";
import { sendTx } from "../lib/sendTx.js";
import { setupSigner } from "../lib/setup.js";

async function main() {
  const devnet = devnetRpc();
  const funder = await loadFunderKeypair();
  const relayer = await loadOrGenerateKeypair(".devnet/05-relayer.keypair.json");
  await ensureFunded(devnet, relayer, 0.008e9, funder);

  section("Setup: nonce accounts A and B under one cold key");
  const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(devnet, relayer, {
    nonceAccounts: 2,
    pdaLamports: 2_000_000n,
  });
  const [accountA, accountB] = nonceAccounts;
  logTx("setup", setupSignature);
  const transfer = () =>
    getTransferSolInstruction({ source: createNoopSigner(pda), destination: relayer.address, amount: 1_000n });

  section("Pre-sign a payload on each, hold both back");
  const nonceA = await fetchStoredNonce(devnet.rpc, accountA);
  const payloadA = await presign(cold, accountA, nonceA, [transfer()]);
  const payloadB = await presign(cold, accountB, await fetchStoredNonce(devnet.rpc, accountB), [transfer()]);

  section("Revoke A: an empty payload at A's outstanding nonce");
  const revocation = await presign(cold, accountA, nonceA, []);
  logTx("revocation", await sendTx(devnet, relayer, [revocation.submit]));

  section("A's payload can no longer land");
  try {
    await sendTx(devnet, relayer, [payloadA.submit]);
    console.log("UNEXPECTED: revoked payload landed");
    process.exit(1);
  } catch (err) {
    console.log(`rejected, A's nonce moved on: ${firstLine(err)}`);
  }

  section("B's payload still lands");
  logTx("B (unaffected)", await sendTx(devnet, relayer, [payloadB.submit]));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
