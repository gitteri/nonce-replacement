/**
 * Vector's canonical Ed25519 program (`vectorcLBXJ2TuoKuUygkEi6FWqvBnbHDEDWoYamfjV`)
 * is not deployed on devnet or mainnet-beta (`getAccountInfo` returns null on
 * both as of this writing). These example scripts build the same on-chain
 * program from the Vector repo's source and deploy it to devnet under a
 * self-generated program ID instead — see README.md for the deploy step.
 *
 * Vector's `*Ed25519` convenience wrappers (`createInitializeEd25519`,
 * `signAdvanceInstructionEd25519`, `verifyAdvanceSignatureEd25519`, ...) all
 * hardcode the canonical `ED25519` Scheme constant, vanity program ID
 * included. Since we deploy under a different address, this module
 * re-derives the same thin wrappers around the SDK's generic (non-hardcoded)
 * primitives, bound to our devnet program ID instead.
 */
import { Address, TransactionInstruction } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  ED25519,
  Scheme,
  advanceVectorDigest,
  createAdvanceInstruction,
  createInitializeInstruction,
} from "vector-sdk";

const programIdEnv = process.env.VECTOR_DEVNET_PROGRAM_ID;
if (!programIdEnv) {
  throw new Error(
    "VECTOR_DEVNET_PROGRAM_ID is not set. Deploy programs/ed25519 to devnet " +
      "(see README.md) and export its program ID before running these scripts."
  );
}

/** The devnet-deployed Ed25519 Scheme: identical to the SDK's `ED25519` bar the program ID. */
export const ED25519_DEVNET: Scheme = {
  ...ED25519,
  programId: new Address(programIdEnv),
};

export function ed25519Identity(signingKey: Uint8Array): Uint8Array {
  return ed25519.getPublicKey(signingKey);
}

export function createInitializeEd25519Devnet(
  payer: Address,
  pubkey: Uint8Array
): TransactionInstruction {
  return createInitializeInstruction(payer, ED25519_DEVNET, pubkey, pubkey);
}

export function signAdvanceEd25519Devnet(
  signingKey: Uint8Array,
  nonce: Uint8Array,
  preInstructions: TransactionInstruction[],
  postInstructions: TransactionInstruction[],
  feePayer?: Address
): TransactionInstruction {
  const identity = ed25519Identity(signingKey);
  const digest = advanceVectorDigest(
    ED25519_DEVNET,
    nonce,
    identity,
    preInstructions,
    postInstructions,
    feePayer
  );
  const signature = ed25519.sign(digest, signingKey);
  return createAdvanceInstruction(ED25519_DEVNET, identity, signature);
}

export function signRevocationEd25519Devnet(
  signingKey: Uint8Array,
  nonce: Uint8Array
): TransactionInstruction {
  return signAdvanceEd25519Devnet(signingKey, nonce, [], []);
}

/**
 * Offline verification against our devnet scheme — mirrors the SDK's
 * `verifyAdvanceSignatureEd25519`, which cannot be reused directly because it
 * hardcodes the canonical (undeployed) `ED25519` program ID internally.
 */
export function verifyAdvanceEd25519Devnet(
  pubkey: Uint8Array,
  nonce: Uint8Array,
  preInstructions: TransactionInstruction[],
  postInstructions: TransactionInstruction[],
  signature: Uint8Array,
  feePayer?: Address
): Uint8Array {
  const digest = advanceVectorDigest(
    ED25519_DEVNET,
    nonce,
    pubkey,
    preInstructions,
    postInstructions,
    feePayer
  );
  if (!ed25519.verify(signature, digest, pubkey)) {
    throw new Error(
      "ed25519: signature does not verify over the recomputed advance digest"
    );
  }
  return digest;
}
