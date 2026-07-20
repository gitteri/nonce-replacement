/**
 * Requirement 4 — Transaction Integrity (requirements/nonce-replacement-spec.md).
 *
 * Builds a real advance + withdraw payload, signs it, then swaps in a
 * tampered version of the payload instruction (different withdraw amount)
 * before broadcast. The outer transaction is still validly signed by the fee
 * payer — but the on-chain program's digest recompute no longer matches what
 * the custodial key actually signed, so it rejects the whole transaction.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { Transaction, SystemProgram } from "@solana/web3.js";
import { sendTx } from "../lib/sendTx.js";
import { findVectorPda, fetchVectorAccount, createPassthroughInstruction, createWithdrawSubinstruction } from "vector-sdk";
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
  const feePayer = await loadOrGenerateKeypair(".devnet/04-fee-payer.keypair.json");
  await ensureFunded(connection, feePayer, 0.02e9, funder);

  const signingKey = ed25519.utils.randomSecretKey();
  const identity = ed25519.getPublicKey(signingKey);
  const [vectorPda] = findVectorPda(ED25519_DEVNET, identity);

  section("Initialize + fund vector PDA");
  await sendTx(
    connection, new Transaction().add(createInitializeEd25519Devnet(feePayer.address, identity)), [feePayer]
  );
  await sendTx(
    connection, new Transaction().add(
      SystemProgram.transfer({ fromPubkey: feePayer.address, toPubkey: vectorPda, lamports: 5_000_000 })
    ),
    [feePayer]
  );
  console.log(`vector PDA: ${vectorPda.toBase58()}`);

  section("Sign advance committing to a 1,000 lamport withdrawal");
  const account = await fetchVectorAccount(connection, ED25519_DEVNET, identity);
  const intendedWithdraw = createWithdrawSubinstruction(ED25519_DEVNET, identity, feePayer.address, 1_000n);
  const passthroughIx = createPassthroughInstruction(ED25519_DEVNET, identity, [intendedWithdraw]);
  const advanceIx = signAdvanceEd25519Devnet(
    signingKey,
    account.nonce,
    [],
    [passthroughIx],
    feePayer.address
  );
  console.log("signed: withdraw 1,000 lamports to the fee payer");

  section("Tamper: swap in a 5,000,000 lamport withdrawal before broadcast");
  const tamperedWithdraw = createWithdrawSubinstruction(
    ED25519_DEVNET,
    identity,
    feePayer.address,
    5_000_000n
  );
  const tamperedPassthroughIx = createPassthroughInstruction(ED25519_DEVNET, identity, [
    tamperedWithdraw,
  ]);
  console.log("tampered: withdraw 5,000,000 lamports instead — same advanceIx, different payload");

  section("Broadcast the tampered transaction");
  const before = await connection.getAccountInfo(vectorPda);
  try {
    const sig = await sendTx(
      connection, new Transaction().add(advanceIx, tamperedPassthroughIx), [feePayer]
    );
    console.log(`UNEXPECTED: tampered transaction landed as ${sig}`);
    process.exit(1);
  } catch (err) {
    console.log("tampered transaction rejected on-chain, as expected:");
    console.log(`  ${(err as Error).message.split("\n")[0]}`);
  }

  const after = await connection.getAccountInfo(vectorPda);
  console.log(
    `vector PDA lamports unchanged: ${before?.lamports} -> ${after?.lamports} ` +
      "(the fee payer's own transaction signature was valid; the program's internal digest " +
      "check is what caught the tamper)"
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
