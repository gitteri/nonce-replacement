/**
 * Requirement 9 — Composability (requirements/nonce-replacement-spec.md).
 *
 * Uses `passthrough` to temporarily hand an SPL mint's authority from the
 * vector PDA to an EOA, mint tokens, then hand authority back — all
 * authorized by a single signed advance, arbitrary CPI included. Standard
 * SPL Token instructions, no Vector-specific SDK required on the mint side.
 *
 * Gap noted in the output: there is currently no wallet-standard adapter for
 * Vector, so integrating this flow into a browser wallet still requires
 * bespoke glue rather than a drop-in wallet-standard connection.
 */
import "../lib/splCompat.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { Keypair, Transaction, SystemProgram } from "@solana/web3.js";
import { sendTx } from "../lib/sendTx.js";
import {
  AuthorityType,
  createAssociatedTokenAccountInstruction,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { findVectorPda, fetchVectorAccount, createPassthroughInstruction } from "vector-sdk";
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
  const feePayer = await loadOrGenerateKeypair(".devnet/09-fee-payer.keypair.json");
  await ensureFunded(connection, feePayer, 0.05e9, funder);

  const signingKey = ed25519.utils.randomSecretKey();
  const identity = ed25519.getPublicKey(signingKey);
  const [vectorPda] = findVectorPda(ED25519_DEVNET, identity);

  section("Initialize vector account");
  await sendTx(
    connection, new Transaction().add(createInitializeEd25519Devnet(feePayer.address, identity)), [feePayer]
  );
  console.log(`vector PDA: ${vectorPda.toBase58()}`);

  section("Create an SPL mint with authority = vector PDA");
  const mint = await Keypair.generate();
  const rentExempt = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
  await sendTx(
    connection,
    new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: feePayer.address,
        newAccountPubkey: mint.address,
        space: MINT_SIZE,
        lamports: rentExempt,
        programId: TOKEN_PROGRAM_ID,
      }),
      createInitializeMint2Instruction(mint.address as any, 6, vectorPda as any, null)
    ),
    [feePayer, mint]
  );
  console.log(`mint: ${mint.address.toBase58()}, authority: ${vectorPda.toBase58()}`);

  const destination = getAssociatedTokenAddressSync(mint.address as any, feePayer.address as any);
  await sendTx(
    connection,
    new Transaction().add(
      createAssociatedTokenAccountInstruction(
        feePayer.address as any,
        destination,
        feePayer.address as any,
        mint.address as any
      )
    ),
    [feePayer]
  );

  section("One signed advance: PDA -> EOA authority, mint, EOA -> PDA authority");
  const pdaToEoa = createSetAuthorityInstruction(
    mint.address as any,
    vectorPda as any,
    AuthorityType.MintTokens,
    feePayer.address as any
  );
  const mintToIx = createMintToInstruction(mint.address as any, destination, feePayer.address as any, 10_000);
  const eoaToPda = createSetAuthorityInstruction(
    mint.address as any,
    feePayer.address as any,
    AuthorityType.MintTokens,
    vectorPda as any
  );

  const passthroughIx = createPassthroughInstruction(ED25519_DEVNET, identity, [pdaToEoa]);
  const postIxs = [passthroughIx, mintToIx, eoaToPda];

  const account = await fetchVectorAccount(connection, ED25519_DEVNET, identity);
  const advanceIx = signAdvanceEd25519Devnet(signingKey, account.nonce, [], postIxs, feePayer.address);

  const sig = await sendTx(
    connection,
    new Transaction().add(advanceIx, ...postIxs),
    [feePayer]
  );
  logTx("advance (round trip)", sig);

  section("Verify: minted, authority restored to the PDA");
  const tokenInfo = await getAccount(connection, destination);
  console.log(`minted: ${tokenInfo.amount} base units`);
  const mintInfo = await getMint(connection, mint.address as any);
  console.log(`mint authority: ${(mintInfo.mintAuthority as any)?.toBase58?.() ?? mintInfo.mintAuthority}`);
  console.log(`matches vector PDA: ${(mintInfo.mintAuthority as any)?.toBase58?.() === vectorPda.toBase58()}`);

  console.log(
    "\ngap: standard SPL Token instructions worked with zero Vector-specific tooling on the " +
      "mint side (only the passthrough wrapper is Vector-specific). There is no wallet-standard " +
      "adapter for Vector yet, so browser wallet integration still needs bespoke glue rather " +
      "than a drop-in wallet-standard connection."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
