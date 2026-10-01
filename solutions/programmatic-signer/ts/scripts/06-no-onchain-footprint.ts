/**
 * Requirement 6 — No Onchain Footprint at Signing Time (requirements/nonce-replacement-spec.md).
 *
 * Signing is offline math over the nonce value. This signs three chained transfers, computing each
 * successor nonce locally, and checks that no account it touches changes until the first Submit
 * lands.
 */
import { getTransferSolInstruction } from "@solana-program/system";
import { createNoopSigner, type Address } from "@solana/kit";
import { devnetRpc } from "../lib/connection.js";
import { ensureFunded, loadFunderKeypair, loadOrGenerateKeypair } from "../lib/keypair.js";
import { logTx, section } from "../lib/format.js";
import { fetchStoredNonce, nextNonce, presign } from "../lib/programmaticSigner.js";
import { sendTx } from "../lib/sendTx.js";
import { setupSigner } from "../lib/setup.js";

async function main() {
  const devnet = devnetRpc();
  const funder = await loadFunderKeypair();
  const relayer = await loadOrGenerateKeypair(".devnet/06-relayer.keypair.json");
  await ensureFunded(devnet, relayer, 0.006e9, funder);

  section("Setup");
  const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(devnet, relayer, {
    pdaLamports: 2_000_000n,
  });
  const [nonceAccount] = nonceAccounts;
  logTx("setup", setupSignature);

  const watched: Address[] = [cold.address, pda, nonceAccount];
  const snapshot = async () =>
    Promise.all(
      watched.map(async (address) => {
        const [signatures, info] = await Promise.all([
          devnet.rpc.getSignaturesForAddress(address, { limit: 1, commitment: "confirmed" }).send(),
          devnet.rpc.getAccountInfo(address, { encoding: "base64", commitment: "confirmed" }).send(),
        ]);
        return JSON.stringify(
          [signatures[0]?.signature ?? null, info.value?.lamports, info.value?.data],
          (_, value) => (typeof value === "bigint" ? value.toString() : value)
        );
      })
    );

  const before = await snapshot();
  section("Sign three chained transfers offline");
  let nonce = await fetchStoredNonce(devnet.rpc, nonceAccount);
  const chain = [];
  for (let i = 0; i < 3; i++) {
    const presigned = await presign(cold, nonceAccount, nonce, [
      getTransferSolInstruction({
        source: createNoopSigner(pda),
        destination: relayer.address,
        amount: BigInt(1_000 + i),
      }),
    ]);
    chain.push(presigned);
    console.log(`#${i} signed at nonce ${nonce}`);
    nonce = nextNonce(nonceAccount, nonce, presigned.executionMessage);
  }
  const after = await snapshot();
  for (const [i, address] of watched.entries()) {
    console.log(`${address}: ${before[i] === after[i] ? "unchanged" : "CHANGED"}`);
  }
  if (before.some((value, i) => value !== after[i])) process.exit(1);

  section("Land the chain");
  for (const [i, presigned] of chain.entries()) {
    logTx(`#${i}`, await sendTx(devnet, relayer, [presigned.submit]));
  }
  const stored = await fetchStoredNonce(devnet.rpc, nonceAccount);
  console.log(`stored nonce ${stored} ${stored === nonce ? "matches" : "DOES NOT match"} the offline prediction`);
  if (stored !== nonce) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
