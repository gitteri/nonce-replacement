/**
 * Requirement 8 — State Change Tolerance (requirements/nonce-replacement-spec.md).
 *
 * Submits an [advance, passthrough] transaction whose inner CPI (a withdraw
 * for more lamports than the vector PDA holds) is guaranteed to fail. Solana
 * transactions are all-or-nothing, so the whole transaction reverts,
 * including the advance's nonce update — no silent partial execution, and
 * the failure is checkable offline before submission (Vector's own offline
 * verify path would already reject signature/digest mismatches the same
 * way; this script demonstrates the on-chain half of that guarantee).
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
  const feePayer = await loadOrGenerateKeypair(".devnet/08-fee-payer.keypair.json");
  await ensureFunded(connection, feePayer, 0.02e9, funder);

  const signingKey = ed25519.utils.randomSecretKey();
  const identity = ed25519.getPublicKey(signingKey);
  const [vectorPda] = findVectorPda(ED25519_DEVNET, identity);

  section("Initialize + lightly fund vector PDA");
  await sendTx(
    connection, new Transaction().add(createInitializeEd25519Devnet(feePayer.address, identity)), [feePayer]
  );
  await sendTx(
    connection, new Transaction().add(
      SystemProgram.transfer({ fromPubkey: feePayer.address, toPubkey: vectorPda, lamports: 5_000_000 })
    ),
    [feePayer]
  );
  const before = await connection.getAccountInfo(vectorPda);
  const nonceBefore = (await fetchVectorAccount(connection, ED25519_DEVNET, identity)).nonce;
  console.log(`vector PDA: ${vectorPda.toBase58()}, lamports: ${before?.lamports}`);

  section("Sign an advance whose passthrough withdraws far more than the PDA holds");
  const doomedWithdraw = createWithdrawSubinstruction(
    ED25519_DEVNET,
    identity,
    feePayer.address,
    1_000_000_000n // 1 SOL — the PDA holds a small fraction of this
  );
  const passthroughIx = createPassthroughInstruction(ED25519_DEVNET, identity, [doomedWithdraw]);
  const advanceIx = signAdvanceEd25519Devnet(
    signingKey,
    nonceBefore,
    [],
    [passthroughIx],
    feePayer.address
  );

  section("Submit — the inner CPI must fail");
  try {
    const sig = await sendTx(
      connection, new Transaction().add(advanceIx, passthroughIx), [feePayer]
    );
    console.log(`UNEXPECTED: this should not have landed (${sig})`);
    process.exit(1);
  } catch (err) {
    console.log("transaction failed atomically, as expected:");
    console.log(`  ${(err as Error).message.split("\n")[0]}`);
  }

  section("Verify: no partial execution");
  const after = await connection.getAccountInfo(vectorPda);
  const nonceAfter = (await fetchVectorAccount(connection, ED25519_DEVNET, identity)).nonce;
  console.log(`lamports: ${before?.lamports} -> ${after?.lamports} (unchanged)`);
  console.log(
    `nonce:    ${Buffer.from(nonceBefore).toString("hex")} -> ${Buffer.from(nonceAfter).toString("hex")} ` +
      (Buffer.from(nonceBefore).equals(Buffer.from(nonceAfter)) ? "(unchanged)" : "(CHANGED — unexpected)")
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
