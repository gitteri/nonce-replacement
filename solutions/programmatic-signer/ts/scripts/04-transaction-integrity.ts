/**
 * Requirement 4 — Transaction Integrity (requirements/nonce-replacement-spec.md).
 *
 * The signature covers the whole authorization message, which embeds every payload instruction
 * and account. A relayer that bumps the amount or swaps the destination is rejected. The relayer
 * can still add its own top-level instructions around Submit, but those don't get the programmatic
 * signer's authority.
 */
import { getTransferSolInstruction } from "@solana-program/system";
import { createNoopSigner, generateKeyPairSigner, type Instruction } from "@solana/kit";
import { devnetRpc } from "../lib/connection.js";
import { ensureFunded, loadFunderKeypair, loadOrGenerateKeypair } from "../lib/keypair.js";
import { firstLine, logTx, section } from "../lib/format.js";
import { fetchStoredNonce, presign } from "../lib/programmaticSigner.js";
import { assertRejectedOnchain, sendTx } from "../lib/sendTx.js";
import { setupSigner } from "../lib/setup.js";

const AMOUNT = 1_000n;
// Enough to leave the fresh destination rent-exempt.
const TIP = 1_000_000n;

async function main() {
  const devnet = devnetRpc();
  const funder = await loadFunderKeypair();
  const relayer = await loadOrGenerateKeypair(".devnet/04-relayer.keypair.json");
  await ensureFunded(devnet, relayer, 0.006e9, funder);

  section("Setup");
  const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(devnet, relayer, {
    pdaLamports: 2_000_000n,
  });
  logTx("setup", setupSignature);
  const destination = (await generateKeyPairSigner()).address;
  const nonce = await fetchStoredNonce(devnet.rpc, nonceAccounts[0]);
  const { submit } = await presign(cold, nonceAccounts[0], nonce, [
    getTransferSolInstruction({ source: createNoopSigner(pda), destination, amount: AMOUNT }),
  ]);
  console.log(`signed a ${AMOUNT} lamport transfer to ${destination}`);

  const bumped = Uint8Array.from(submit.data!);
  new DataView(bumped.buffer).setBigUint64(bumped.length - 8, 1_000_000n, true);
  const accounts = submit.accounts!;
  const destinationIndex = accounts.findIndex((meta) => meta.address === destination);

  const attempts: [string, Instruction][] = [
    [
      "amount bumped to 1,000,000",
      { ...submit, data: bumped },
    ],
    [
      "destination swapped for the relayer",
      {
        ...submit,
        accounts: accounts.map((meta, i) =>
          i === destinationIndex ? { ...meta, address: relayer.address } : meta
        ),
      },
    ],
  ];
  for (const [label, tampered] of attempts) {
    section(`Tampered: ${label}`);
    try {
      await sendTx(devnet, relayer, [tampered]);
      console.log("UNEXPECTED: tampered transaction landed");
      process.exit(1);
    } catch (err) {
      assertRejectedOnchain(err);
      console.log(`rejected: ${firstLine(err)}`);
    }
  }

  section("Untouched, with a relayer instruction of its own alongside");
  const tip = getTransferSolInstruction({ source: relayer, destination, amount: TIP });
  logTx("submit", await sendTx(devnet, relayer, [tip, submit]));
  const received = (await devnet.rpc.getBalance(destination).send()).value;
  console.log(`destination holds ${received} lamports: ${AMOUNT} signed by the cold key, ${TIP} from the relayer`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
