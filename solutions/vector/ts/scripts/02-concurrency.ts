/**
 * Requirement 2 — Concurrency (requirements/nonce-replacement-spec.md).
 *
 * Three independent Vector identities ("lanes"), each with its own PDA and
 * nonce. One pre-signed advance per lane, landed together, to show batched
 * pre-signing doesn't serialize on a single shared nonce the way a single
 * durable-nonce account would — each lane advances independently.
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

const LANE_COUNT = 3;

async function main() {
  const connection = devnetConnection();
  const funder = await loadFunderKeypair();
  const feePayer = await loadOrGenerateKeypair(".devnet/02-fee-payer.keypair.json");
  await ensureFunded(connection, feePayer, 0.05e9, funder);

  section(`Initialize ${LANE_COUNT} independent lanes`);
  const lanes = [];
  for (let i = 0; i < LANE_COUNT; i++) {
    const signingKey = ed25519.utils.randomSecretKey();
    const identity = ed25519.getPublicKey(signingKey);
    const [vectorPda] = findVectorPda(ED25519_DEVNET, identity);
    const initSig = await sendTx(
      connection, new Transaction().add(createInitializeEd25519Devnet(feePayer.address, identity)), [feePayer]
    );
    console.log(`lane ${i}: pda ${vectorPda.toBase58()}`);
    logTx(`lane ${i} initialize`, initSig);
    lanes.push({ signingKey, identity, vectorPda });
  }

  section("Pre-sign one advance per lane (lane-pool pattern)");
  const advances = [];
  for (let i = 0; i < lanes.length; i++) {
    const account = await fetchVectorAccount(connection, ED25519_DEVNET, lanes[i].identity);
    const advanceIx = signAdvanceEd25519Devnet(
      lanes[i].signingKey,
      account.nonce,
      [],
      [],
      feePayer.address
    );
    console.log(`lane ${i}: pre-signed against nonce ${Buffer.from(account.nonce).toString("hex")}`);
    advances.push(advanceIx);
  }
  console.log(
    "each lane's signature is independent — a custodian can maintain a pool of these lanes " +
      "and issue one pre-signed transaction per lane per ceremony, with no cross-lane ordering " +
      "constraint."
  );

  section("Land all lanes");
  const signatures = await Promise.all(
    advances.map((ix) => sendTx(connection, new Transaction().add(ix), [feePayer]))
  );
  signatures.forEach((sig, i) => logTx(`lane ${i} advance`, sig));

  console.log(`\nall ${LANE_COUNT} lanes landed independently and succeeded.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
