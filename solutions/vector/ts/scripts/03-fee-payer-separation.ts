/**
 * Requirement 3 — Fee-Payer Separation (requirements/nonce-replacement-spec.md).
 *
 * Signs an advance digest with the custodial identity key, then lands it
 * with a completely different, separately-funded fee-payer keypair that
 * never appears in the signed instructions — chosen at broadcast time, not
 * sign time.
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
  const initPayer = await loadOrGenerateKeypair(".devnet/03-init-payer.keypair.json");
  const broadcastPayer = await loadOrGenerateKeypair(".devnet/03-broadcast-payer.keypair.json");
  await ensureFunded(connection, initPayer, 0.02e9, funder);
  await ensureFunded(connection, broadcastPayer, 0.02e9, funder);

  console.log(`init payer:      ${initPayer.address.toBase58()}`);
  console.log(`broadcast payer: ${broadcastPayer.address.toBase58()} (unrelated, separately funded)`);

  const signingKey = ed25519.utils.randomSecretKey();
  const identity = ed25519.getPublicKey(signingKey);
  const [vectorPda] = findVectorPda(ED25519_DEVNET, identity);

  section("Initialize vector account");
  const initSig = await sendTx(
    connection,
    new Transaction().add(createInitializeEd25519Devnet(initPayer.address, identity)),
    [initPayer]
  );
  logTx("initialize", initSig);
  console.log(`vector PDA: ${vectorPda.toBase58()}`);

  section("Sign the advance — no fee payer bound at sign time");
  const account = await fetchVectorAccount(connection, ED25519_DEVNET, identity);
  // feePayer omitted: the digest does not fold in any fee payer, so any
  // fee-payer can broadcast this later, chosen at broadcast time.
  const advanceIx = signAdvanceEd25519Devnet(signingKey, account.nonce, [], []);
  console.log("advance signed with no feePayer parameter — the signature does not commit to who broadcasts it.");

  section("Land it with a completely unrelated fee payer");
  const advanceSig = await sendTx(
    connection,
    new Transaction().add(advanceIx),
    [broadcastPayer]
  );
  logTx("advance", advanceSig);
  console.log(
    `landed and paid for by ${broadcastPayer.address.toBase58()}, which never appears in the ` +
      "advance instruction's accounts and was never referenced when the signature was produced."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
