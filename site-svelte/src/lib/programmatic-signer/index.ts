// Defaults are Anza's canonical devnet programs, matching
// solutions/programmatic-signer/ts/lib/programs.ts. PUBLIC_PS_* overrides all three.
import { env } from "$env/dynamic/public";
import { address } from "@solana/kit";
import type { ProgramIds } from "./signer";

export const PROGRAM_IDS: ProgramIds = {
  signer: address(env.PUBLIC_PS_SIGNER_PROGRAM_ID ?? "EdSigVfK1DkeMrjFNDMjwfQaJPhPTtX7jW8uPv3oKEgN"),
  executor: address(env.PUBLIC_PS_EXECUTOR_PROGRAM_ID ?? "ExecxgyHYsAXB4c5dZodV1zJZ9hqfsDCYkRDRATrpkFR"),
  nonce: address(env.PUBLIC_PS_NONCE_PROGRAM_ID ?? "Noncediea1fH12usShuQAz28UhgAeuE5Maf32LsMUQB"),
};

export { fromV1Instruction, toV1Instruction } from "./bridge";
export { fetchStoredNonce, missingPrograms, setupSigner, type SignerSetup } from "./chain";
export { decodeSubmit, type DecodedSubmit } from "./parse";
export { nextNonce, presign, type ColdKey, type Presigned, type ProgramIds } from "./signer";
