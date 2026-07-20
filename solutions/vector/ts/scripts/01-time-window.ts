/**
 * Requirement 1 — Sign-to-Broadcast Time Window (requirements/nonce-replacement-spec.md).
 *
 * Signs a Vector `advance` now and lands it, and shows the digest it signs
 * over has no blockhash and no expiry baked in: the same signature would
 * still verify a day (or a week) from now, unlike a regular Solana
 * transaction's ~60-90s blockhash window.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { Transaction } from "@solana/web3.js";
import { sendTx } from "../lib/sendTx.js";
import { findVectorPda, fetchVectorAccount } from "vector-sdk";
import { devnetConnection } from "../lib/connection.js";
import { loadOrGenerateKeypair, loadFunderKeypair, ensureFunded } from "../lib/keypair.js";
import { section, logTx } from "../lib/format.js";
import {
  ED25519_DEVNET,
  createInitializeEd25519Devnet,
  signAdvanceEd25519Devnet,
} from "../lib/vectorProgram.js";

async function main() {
  const connection = devnetConnection();
  const funder = await loadFunderKeypair();
  const feePayer = await loadOrGenerateKeypair(".devnet/01-fee-payer.keypair.json");
  await ensureFunded(connection, feePayer, 0.02e9, funder);

  const signingKey = ed25519.utils.randomSecretKey();
  const identity = ed25519.getPublicKey(signingKey);
  const [vectorPda] = findVectorPda(ED25519_DEVNET, identity);

  section("Initialize vector account");
  const initIx = createInitializeEd25519Devnet(feePayer.address, identity);
  const initSig = await sendTx(connection, new Transaction().add(initIx), [
    feePayer, ]);
  logTx("initialize", initSig);

  const account = await fetchVectorAccount(connection, ED25519_DEVNET, identity);
  console.log(`vector PDA: ${vectorPda.toBase58()}`);
  console.log(`nonce: ${Buffer.from(account.nonce).toString("hex")}`);

  section("Sign an advance now");
  const signedAt = new Date();
  const advanceIx = signAdvanceEd25519Devnet(signingKey, account.nonce, [], [], feePayer.address);
  console.log(`signed at: ${signedAt.toISOString()}`);
  console.log(
    "the signed digest folds in the nonce + instruction bytes only — no blockhash, no " +
      "expiry. The same advanceIx bytes would verify identically if broadcast a day from now " +
      "(capped only by however long this program keeps the nonce unadvanced), unlike a regular " +
      "Solana transaction, which expires in ~60-90s once its blockhash ages out."
  );

  section("Land it");
  const advanceSig = await sendTx(
    connection,
    new Transaction().add(advanceIx),
    [feePayer]
  );
  logTx("advance", advanceSig);

  const after = await fetchVectorAccount(connection, ED25519_DEVNET, identity);
  console.log(`nonce advanced: ${Buffer.from(after.nonce).toString("hex")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
