/**
 * Requirement 9 — Composability (requirements/nonce-replacement-spec.md).
 *
 * The programmatic signer owns an SPL token account. The cold key signs a TransferChecked with the
 * PDA as owner, and the Executor CPIs the Token program with the PDA promoted to signer, so the
 * payload program runs two CPI levels below Submit.
 */
import {
  TOKEN_PROGRAM_ADDRESS,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getInitializeMint2Instruction,
  getMintSize,
  getMintToInstruction,
  getTransferCheckedInstruction,
} from "@solana-program/token";
import { getCreateAccountInstruction } from "@solana-program/system";
import { createNoopSigner, generateKeyPairSigner } from "@solana/kit";
import { devnetRpc } from "../lib/connection.js";
import { ensureFunded, loadFunderKeypair, loadOrGenerateKeypair } from "../lib/keypair.js";
import { logTx, section } from "../lib/format.js";
import { fetchStoredNonce, presign } from "../lib/programmaticSigner.js";
import { sendTx } from "../lib/sendTx.js";
import { setupSigner } from "../lib/setup.js";

const DECIMALS = 6;

async function main() {
  const devnet = devnetRpc();
  const funder = await loadFunderKeypair();
  const relayer = await loadOrGenerateKeypair(".devnet/09-relayer.keypair.json");
  await ensureFunded(devnet, relayer, 0.012e9, funder);

  section("Setup: cold key, a mint, and token accounts for the PDA and the relayer");
  const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(devnet, relayer);
  logTx("signer setup", setupSignature);
  const mint = await generateKeyPairSigner();
  const owner = { tokenProgram: TOKEN_PROGRAM_ADDRESS, mint: mint.address };
  const [pdaAta] = await findAssociatedTokenPda({ ...owner, owner: pda });
  const [relayerAta] = await findAssociatedTokenPda({ ...owner, owner: relayer.address });
  const mintRent = await devnet.rpc.getMinimumBalanceForRentExemption(BigInt(getMintSize())).send();
  logTx(
    "token setup",
    await sendTx(devnet, relayer, [
      getCreateAccountInstruction({
        payer: relayer,
        newAccount: mint,
        lamports: mintRent,
        space: getMintSize(),
        programAddress: TOKEN_PROGRAM_ADDRESS,
      }),
      getInitializeMint2Instruction({ mint: mint.address, decimals: DECIMALS, mintAuthority: relayer.address }),
      getCreateAssociatedTokenIdempotentInstruction({ payer: relayer, ata: pdaAta, owner: pda, mint: mint.address }),
      getCreateAssociatedTokenIdempotentInstruction({
        payer: relayer,
        ata: relayerAta,
        owner: relayer.address,
        mint: mint.address,
      }),
      getMintToInstruction({ mint: mint.address, token: pdaAta, mintAuthority: relayer, amount: 10_000_000n }),
    ])
  );
  console.log(`mint ${mint.address}, PDA token account ${pdaAta} holds 10.0`);

  section("Cold key signs a TransferChecked of 2.5 with the PDA as owner");
  const nonce = await fetchStoredNonce(devnet.rpc, nonceAccounts[0]);
  const { submit } = await presign(cold, nonceAccounts[0], nonce, [
    getTransferCheckedInstruction({
      source: pdaAta,
      mint: mint.address,
      destination: relayerAta,
      authority: createNoopSigner(pda),
      amount: 2_500_000n,
      decimals: DECIMALS,
    }),
  ]);

  section("Land it");
  logTx("submit", await sendTx(devnet, relayer, [submit]));
  const amounts = await Promise.all(
    [pdaAta, relayerAta].map(async (address) => (await fetchToken(devnet.rpc, address)).data.amount)
  );
  console.log(`PDA token account: ${amounts[0]}, relayer token account: ${amounts[1]} (base units)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
