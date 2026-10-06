/**
 * Requirement 2 — Concurrency (requirements/nonce-replacement-spec.md).
 *
 * One cold key controls three nonce accounts. It signs one transfer per account, and they land in
 * reverse order, since nonce accounts don't depend on each other. Then it pre-signs an ordered
 * pair on a single account: the second is signed against the nonce the first will leave behind,
 * so it can't land first.
 */
import { getTransferSolInstruction } from "@solana-program/system";
import { createNoopSigner, type Address } from "@solana/kit";
import { devnetRpc } from "../lib/connection.js";
import { ensureFunded, loadFunderKeypair, loadOrGenerateKeypair } from "../lib/keypair.js";
import { firstLine, logTx, section } from "../lib/format.js";
import { fetchStoredNonce, nextNonce, presign } from "../lib/programmaticSigner.js";
import { assertRejectedOnchain, sendTx } from "../lib/sendTx.js";
import { setupSigner } from "../lib/setup.js";

async function main() {
  const devnet = devnetRpc();
  const funder = await loadFunderKeypair();
  const relayer = await loadOrGenerateKeypair(".devnet/02-relayer.keypair.json");
  await ensureFunded(devnet, relayer, 0.012e9, funder);

  section("One cold key, four nonce accounts");
  const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(devnet, relayer, {
    nonceAccounts: 4,
    pdaLamports: 2_000_000n,
  });
  logTx("setup", setupSignature);
  console.log(`programmatic signer (PDA): ${pda}`);
  const transfer = (amount: bigint) =>
    getTransferSolInstruction({ source: createNoopSigner(pda), destination: relayer.address, amount });

  section("Sign one transfer per nonce account, all outstanding at once");
  const parallel = nonceAccounts.slice(0, 3);
  const presigned = [];
  for (const [i, account] of parallel.entries()) {
    const nonce = await fetchStoredNonce(devnet.rpc, account);
    presigned.push(await presign(cold, account, nonce, [transfer(BigInt(1_000 + i))]));
    console.log(`signed #${i} on ${account}`);
  }

  section("Land them in reverse order");
  for (let i = presigned.length - 1; i >= 0; i--) {
    logTx(`submit #${i}`, await sendTx(devnet, relayer, [presigned[i].submit]));
  }

  section("Pre-sign an ordered pair on one nonce account");
  const chained: Address = nonceAccounts[3];
  const n0 = await fetchStoredNonce(devnet.rpc, chained);
  const first = await presign(cold, chained, n0, [transfer(2_000n)]);
  const n1 = nextNonce(chained, n0, first.executionMessage);
  const second = await presign(cold, chained, n1, [transfer(2_001n)]);
  console.log(`first signed at ${n0}, second at ${n1} (computed offline)`);

  try {
    await sendTx(devnet, relayer, [second.submit]);
    console.log("UNEXPECTED: the second transaction landed before the first");
    process.exit(1);
  } catch (err) {
    assertRejectedOnchain(err);
    console.log(`second rejected before the first lands, as expected: ${firstLine(err)}`);
  }
  logTx("first", await sendTx(devnet, relayer, [first.submit]));
  logTx("second", await sendTx(devnet, relayer, [second.submit]));
  console.log(`stored nonce ${await fetchStoredNonce(devnet.rpc, chained)} (it moved twice)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
