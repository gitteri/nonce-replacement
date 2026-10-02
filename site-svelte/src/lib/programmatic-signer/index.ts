// Defaults are this repo's devnet deployment of the e3c948d build, matching
// solutions/programmatic-signer/ts/lib/programs.ts. PUBLIC_PS_* overrides all three.
import { env } from "$env/dynamic/public";
import { address } from "@solana/kit";
import type { ProgramIds } from "./signer";

export const PROGRAM_IDS: ProgramIds = {
  signer: address(env.PUBLIC_PS_SIGNER_PROGRAM_ID ?? "986H9i8wxYrDsUHtEUR9eNN2tA3Y5xgQDGsfRnhVmgzX"),
  executor: address(env.PUBLIC_PS_EXECUTOR_PROGRAM_ID ?? "4NPokYh4xsQqs3dnwcJvuLPkuZCFj7x4QVQBChv8SDiQ"),
  nonce: address(env.PUBLIC_PS_NONCE_PROGRAM_ID ?? "3nK4iiSeW7Mkx4GRxDXWWEw5H6ZPLG5yETB7JcZTdP5o"),
};

export { toV1Instruction } from "./bridge";
export { fetchStoredNonce, missingPrograms, setupSigner, type SignerSetup } from "./chain";
export { nextNonce, presign, type ColdKey, type Presigned, type ProgramIds } from "./signer";
