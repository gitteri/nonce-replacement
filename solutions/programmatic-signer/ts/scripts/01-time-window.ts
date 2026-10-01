/**
 * Requirement 1 — Sign-to-Broadcast Time Window (requirements/nonce-replacement-spec.md).
 *
 * Signs a transfer offline against the nonce account's current value, waits past a blockhash's
 * lifetime, then lands it. Neither the Signer nor the Executor program reads the clock or slot, so
 * the signature stays valid until that nonce account advances.
 */
import { getTransferSolInstruction } from "@solana-program/system";
import { createNoopSigner } from "@solana/kit";
import { devnetRpc } from "../lib/connection.js";
import { ensureFunded, loadFunderKeypair, loadOrGenerateKeypair } from "../lib/keypair.js";
import { logTx, section } from "../lib/format.js";
import { fetchStoredNonce, presign } from "../lib/programmaticSigner.js";
import { sendTx } from "../lib/sendTx.js";
import { setupSigner } from "../lib/setup.js";

const WAIT_SECONDS = Number(process.env.TIME_WINDOW_WAIT_SECONDS ?? 150);

async function main() {
  const devnet = devnetRpc();
  const funder = await loadFunderKeypair();
  const relayer = await loadOrGenerateKeypair(".devnet/01-relayer.keypair.json");
  await ensureFunded(devnet, relayer, 0.006e9, funder);

  section("Create a nonce account under the cold key's programmatic signer");
  const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(devnet, relayer, {
    pdaLamports: 2_000_000n,
  });
  const [nonceAccount] = nonceAccounts;
  logTx("setup", setupSignature);
  console.log(`cold key: ${cold.address}`);
  console.log(`programmatic signer (PDA): ${pda}`);
  const nonce = await fetchStoredNonce(devnet.rpc, nonceAccount);
  console.log(`nonce account ${nonceAccount} holds ${nonce}`);

  section("Sign a transfer offline");
  const presigned = await presign(cold, nonceAccount, nonce, [
    getTransferSolInstruction({
      source: createNoopSigner(pda),
      destination: relayer.address,
      amount: 1_000n,
    }),
  ]);
  const signedAt = new Date();
  console.log(`signed at ${signedAt.toISOString()}`);
  console.log(
    "the signed bytes carry the nonce where a blockhash would go and no expiry. Nothing in Signer or " +
      "Executor checks the clock or slot, so this stays valid until the nonce account advances."
  );

  section(`Wait ${WAIT_SECONDS}s, past the ~60-90s a recent blockhash lives`);
  await new Promise((resolve) => setTimeout(resolve, WAIT_SECONDS * 1000));

  section("Land it");
  const signature = await sendTx(devnet, relayer, [presigned.submit]);
  logTx(`submit (${Math.round((Date.now() - signedAt.getTime()) / 1000)}s after signing)`, signature);
  console.log(`nonce advanced to ${await fetchStoredNonce(devnet.rpc, nonceAccount)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
