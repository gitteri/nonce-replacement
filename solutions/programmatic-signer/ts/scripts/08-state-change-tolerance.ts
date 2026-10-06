/**
 * Requirement 8 — State Change Tolerance (requirements/nonce-replacement-spec.md).
 *
 * Submit, Execute, the nonce advance and every payload instruction run in one transaction. A
 * payload whose second transfer overdraws the programmatic signer fails as a whole: the first
 * transfer is rolled back and the nonce stays put. A fresh payload signed at the same nonce then
 * lands.
 */
import { getTransferSolInstruction } from "@solana-program/system";
import { createNoopSigner, generateKeyPairSigner } from "@solana/kit";
import { devnetRpc } from "../lib/connection.js";
import { ensureFunded, loadFunderKeypair, loadOrGenerateKeypair } from "../lib/keypair.js";
import { firstLine, logTx, section } from "../lib/format.js";
import { fetchStoredNonce, presign } from "../lib/programmaticSigner.js";
import { assertRejectedOnchain, sendTx } from "../lib/sendTx.js";
import { setupSigner } from "../lib/setup.js";

async function main() {
  const devnet = devnetRpc();
  const funder = await loadFunderKeypair();
  const relayer = await loadOrGenerateKeypair(".devnet/08-relayer.keypair.json");
  await ensureFunded(devnet, relayer, 0.006e9, funder);

  section("Setup: PDA funded with 2,000,000 lamports");
  const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(devnet, relayer, {
    pdaLamports: 2_000_000n,
  });
  const [nonceAccount] = nonceAccounts;
  logTx("setup", setupSignature);
  const destination = (await generateKeyPairSigner()).address;
  const transfer = (amount: bigint) =>
    getTransferSolInstruction({ source: createNoopSigner(pda), destination, amount });
  const balance = async (address: typeof pda) => (await devnet.rpc.getBalance(address).send()).value;

  section("Payload: transfer 1,000,000, then 5,000,000 (overdraws)");
  const nonce = await fetchStoredNonce(devnet.rpc, nonceAccount);
  const failing = await presign(cold, nonceAccount, nonce, [transfer(1_000_000n), transfer(5_000_000n)]);
  try {
    await sendTx(devnet, relayer, [failing.submit]);
    console.log("UNEXPECTED: overdrawing payload landed");
    process.exit(1);
  } catch (err) {
    assertRejectedOnchain(err);
    console.log(`failed: ${firstLine(err)}`);
  }
  const unchanged = (await fetchStoredNonce(devnet.rpc, nonceAccount)) === nonce;
  console.log(`destination balance: ${await balance(destination)} (first transfer rolled back)`);
  console.log(`nonce ${unchanged ? "unchanged" : "MOVED"}: ${nonce}`);
  if (!unchanged || (await balance(destination)) !== 0n) process.exit(1);

  section("Re-sign a valid payload at the same nonce");
  const valid = await presign(cold, nonceAccount, nonce, [transfer(1_000_000n)]);
  logTx("submit", await sendTx(devnet, relayer, [valid.submit]));
  console.log(`destination balance: ${await balance(destination)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
