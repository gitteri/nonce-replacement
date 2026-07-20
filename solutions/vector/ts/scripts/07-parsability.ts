/**
 * Requirement 7 — Transaction Parsability (requirements/nonce-replacement-spec.md).
 *
 * Builds an [advance, ...payload] transaction where the payload is a plain
 * System Program transfer bound into the advance digest as a post-instruction.
 * The payload instruction carries zero Vector-specific framing — any
 * standard Solana tool (here, web3.js's own `SystemInstruction` decoder) can
 * parse it exactly as it would without Vector in the picture at all.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { Transaction, SystemProgram, SystemInstruction } from "@solana/web3.js";
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
  const feePayer = await loadOrGenerateKeypair(".devnet/07-fee-payer.keypair.json");
  const destination = await loadOrGenerateKeypair(".devnet/07-destination.keypair.json");
  await ensureFunded(connection, feePayer, 0.02e9, funder);

  const signingKey = ed25519.utils.randomSecretKey();
  const identity = ed25519.getPublicKey(signingKey);
  const [vectorPda] = findVectorPda(ED25519_DEVNET, identity);

  section("Initialize vector account");
  await sendTx(
    connection, new Transaction().add(createInitializeEd25519Devnet(feePayer.address, identity)), [feePayer]
  );
  console.log(`vector PDA: ${vectorPda.toBase58()}`);

  section("Build [advance, payload] — payload is a plain System transfer");
  const account = await fetchVectorAccount(connection, ED25519_DEVNET, identity);
  const payloadIx = SystemProgram.transfer({
    fromPubkey: feePayer.address,
    toPubkey: destination.address,
    lamports: 1_000_000, // rent-exempt for a fresh zero-data account
  });
  const advanceIx = signAdvanceEd25519Devnet(
    signingKey,
    account.nonce,
    [],
    [payloadIx],
    feePayer.address
  );

  section("Independently parse the payload — no Vector-specific wrapping visible");
  const decoded = SystemInstruction.decodeTransfer(payloadIx);
  console.log("decoded via web3.js's stock SystemInstruction.decodeTransfer:");
  console.log(`  from:    ${decoded.fromPubkey.toBase58()}`);
  console.log(`  to:      ${decoded.toPubkey.toBase58()}`);
  console.log(`  lamports: ${decoded.lamports}`);
  console.log(
    "this is the exact same instruction a policy engine or cold-wallet parser would see for a " +
      "vanilla transfer with no Vector in the picture — the digest binding lives entirely in " +
      "the separate advance instruction, not in the payload."
  );

  section("Land it");
  const sig = await sendTx(
    connection,
    new Transaction().add(advanceIx, payloadIx),
    [feePayer]
  );
  logTx("advance + payload", sig);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
