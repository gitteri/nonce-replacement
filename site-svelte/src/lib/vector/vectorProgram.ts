/**
 * Browser port of solutions/vector/ts/lib/vectorProgram.ts — see that file for why a
 * self-deployed devnet program ID is used instead of Vector's canonical (undeployed)
 * one, and why the SDK's hardcoded `*Ed25519` wrappers get re-derived against it here.
 *
 * `FR1dUTeUCeGiHC4y4aAR2AgqcXvmLAkLv9KDvFwRB14y` is the same devnet deployment the CLI
 * scripts use. Override with PUBLIC_VECTOR_DEVNET_PROGRAM_ID to point at a different
 * one (must be PUBLIC_-prefixed to reach the browser bundle).
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  ED25519,
  type Scheme,
  advanceVectorDigest,
  createAdvanceInstruction,
  createInitializeInstruction,
} from "vector-sdk";
import { Address, type V3TransactionInstruction } from "./web3-v3";
import { env } from "$env/dynamic/public";

const DEFAULT_DEVNET_PROGRAM_ID = "FR1dUTeUCeGiHC4y4aAR2AgqcXvmLAkLv9KDvFwRB14y";
const programIdEnv = env.PUBLIC_VECTOR_DEVNET_PROGRAM_ID ?? DEFAULT_DEVNET_PROGRAM_ID;

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
): V3TransactionInstruction {
  return createInitializeInstruction(payer, ED25519_DEVNET, pubkey, pubkey);
}

export function signAdvanceEd25519Devnet(
  signingKey: Uint8Array,
  nonce: Uint8Array,
  preInstructions: V3TransactionInstruction[],
  postInstructions: V3TransactionInstruction[],
  feePayer?: Address
): V3TransactionInstruction {
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
): V3TransactionInstruction {
  return signAdvanceEd25519Devnet(signingKey, nonce, [], []);
}
