/**
 * Requirement 5 — Selective Revocation (requirements/nonce-replacement-spec.md).
 *
 * Lane A pre-signs a payload transaction, then the signing authority submits
 * a revocation (an inert advance) unilaterally, before the payload lands.
 * The pre-signed payload can no longer land — its signature was computed
 * against a nonce the account no longer holds. Lane B is untouched to show
 * the revocation doesn't affect other outstanding transactions from the same
 * authority.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { Connection, Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import { sendTx } from "../lib/sendTx.js";
import { findVectorPda, fetchVectorAccount, createPassthroughInstruction, createWithdrawSubinstruction } from "vector-sdk";
import { devnetConnection } from "../lib/connection.js";
import { loadOrGenerateKeypair, loadFunderKeypair, ensureFunded } from "../lib/keypair.js";
import { section, logTx } from "../lib/format.js";
import {
  ED25519_DEVNET,
  createInitializeEd25519Devnet,
  signAdvanceEd25519Devnet,
  signRevocationEd25519Devnet,
} from "../lib/vectorProgram.js";

async function initLane(connection: Connection, feePayer: Keypair) {
  const signingKey = ed25519.utils.randomSecretKey();
  const identity = ed25519.getPublicKey(signingKey);
  const [vectorPda] = findVectorPda(ED25519_DEVNET, identity);
  await sendTx(
    connection, new Transaction().add(createInitializeEd25519Devnet(feePayer.address, identity)), [feePayer]
  );
  await sendTx(
    connection, new Transaction().add(
      SystemProgram.transfer({ fromPubkey: feePayer.address, toPubkey: vectorPda, lamports: 5_000_000 })
    ),
    [feePayer]
  );
  return { signingKey, identity, vectorPda };
}

async function main() {
  const connection = devnetConnection();
  const funder = await loadFunderKeypair();
  const feePayer = await loadOrGenerateKeypair(".devnet/05-fee-payer.keypair.json");
  await ensureFunded(connection, feePayer, 0.03e9, funder);

  section("Initialize lane A (to be revoked) and lane B (untouched)");
  const laneA = await initLane(connection, feePayer);
  const laneB = await initLane(connection, feePayer);
  console.log(`lane A pda: ${laneA.vectorPda.toBase58()}`);
  console.log(`lane B pda: ${laneB.vectorPda.toBase58()}`);

  section("Lane A: pre-sign a payload transaction (not yet broadcast)");
  const nonceA = (await fetchVectorAccount(connection, ED25519_DEVNET, laneA.identity)).nonce;
  const withdrawA = createWithdrawSubinstruction(ED25519_DEVNET, laneA.identity, feePayer.address, 1_000n);
  const passthroughA = createPassthroughInstruction(ED25519_DEVNET, laneA.identity, [withdrawA]);
  const payloadAdvanceA = signAdvanceEd25519Devnet(
    laneA.signingKey,
    nonceA,
    [],
    [passthroughA],
    feePayer.address
  );
  console.log("pre-signed a 1,000 lamport withdrawal on lane A. Holding it back — not broadcasting yet.");

  section("Lane A: submit a revocation first");
  const revokeIx = signRevocationEd25519Devnet(laneA.signingKey, nonceA);
  const revokeSig = await sendTx(connection, new Transaction().add(revokeIx), [
    feePayer,
  ]);
  logTx("revocation", revokeSig);

  section("Lane A: the pre-signed payload can no longer land");
  try {
    const sig = await sendTx(
      connection, new Transaction().add(payloadAdvanceA, passthroughA), [feePayer]
    );
    console.log(`UNEXPECTED: revoked payload landed as ${sig}`);
    process.exit(1);
  } catch (err) {
    console.log("rejected, as expected — the account's nonce moved on when the revocation landed:");
    console.log(`  ${(err as Error).message.split("\n")[0]}`);
  }

  section("Lane B: untouched — its own pre-signed payload still lands fine");
  const nonceB = (await fetchVectorAccount(connection, ED25519_DEVNET, laneB.identity)).nonce;
  const withdrawB = createWithdrawSubinstruction(ED25519_DEVNET, laneB.identity, feePayer.address, 1_000n);
  const passthroughB = createPassthroughInstruction(ED25519_DEVNET, laneB.identity, [withdrawB]);
  const advanceB = signAdvanceEd25519Devnet(laneB.signingKey, nonceB, [], [passthroughB], feePayer.address);
  const sigB = await sendTx(
    connection,
    new Transaction().add(advanceB, passthroughB),
    [feePayer]
  );
  logTx("lane B advance (unaffected by lane A's revocation)", sigB);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
