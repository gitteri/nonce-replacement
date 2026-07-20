/**
 * Requirement 6 — No Onchain Footprint at Sign Time (requirements/nonce-replacement-spec.md).
 *
 * Fetches the current nonce once, ahead of time, then computes the signed
 * advance digest and produces a valid Ed25519 signature entirely offline —
 * no RPC calls, no buffer accounts, nothing observable on-chain. Only the
 * final broadcast step touches the network. Proven here by counting
 * `fetch` calls during the signing step itself.
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
  const feePayer = await loadOrGenerateKeypair(".devnet/06-fee-payer.keypair.json");
  await ensureFunded(connection, feePayer, 0.02e9, funder);

  const signingKey = ed25519.utils.randomSecretKey();
  const identity = ed25519.getPublicKey(signingKey);
  const [vectorPda] = findVectorPda(ED25519_DEVNET, identity);

  section("Initialize vector account (network)");
  await sendTx(
    connection, new Transaction().add(createInitializeEd25519Devnet(feePayer.address, identity)), [feePayer]
  );
  console.log(`vector PDA: ${vectorPda.toBase58()}`);

  section("Fetch the nonce once, ahead of time (the one network read)");
  const account = await fetchVectorAccount(connection, ED25519_DEVNET, identity);
  const nonce = account.nonce;
  console.log(`nonce (fetched once): ${Buffer.from(nonce).toString("hex")}`);

  section("Sign fully offline — count fetch() calls during this step");
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = (...args: Parameters<typeof fetch>) => {
    fetchCalls++;
    return originalFetch(...args);
  };

  let advanceIx;
  try {
    // Pure computation: digest + Ed25519 sign, no connection reference at all.
    advanceIx = signAdvanceEd25519Devnet(signingKey, nonce, [], [], feePayer.address);
  } finally {
    globalThis.fetch = originalFetch;
  }

  console.log(`fetch() calls made while signing: ${fetchCalls}`);
  if (fetchCalls !== 0) {
    throw new Error("expected zero RPC calls while producing the signature");
  }
  console.log(
    "zero — a valid, ready-to-broadcast signature was produced with no RPC round-trip and no " +
      "on-chain state change, so nothing here signals intent to an observer watching the chain."
  );

  section("Only now does the network get touched: broadcast");
  const sig = await sendTx(connection, new Transaction().add(advanceIx), [
    feePayer,
  ]);
  logTx("advance", sig);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
