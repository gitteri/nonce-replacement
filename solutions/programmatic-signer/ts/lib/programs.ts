import { address } from "@solana/kit";

/**
 * Program ids for this repo's devnet deployment of the `e3c948d` build (`.vendor/`). Override all
 * three to target another deployment, e.g. the canonical `EdSig...`/`Execx...`/`Noncedie...` ids.
 */
export const SIGNER_PROGRAM = address(
  process.env.PS_SIGNER_PROGRAM_ID ?? "986H9i8wxYrDsUHtEUR9eNN2tA3Y5xgQDGsfRnhVmgzX"
);
export const EXECUTOR_PROGRAM = address(
  process.env.PS_EXECUTOR_PROGRAM_ID ?? "4NPokYh4xsQqs3dnwcJvuLPkuZCFj7x4QVQBChv8SDiQ"
);
export const NONCE_PROGRAM = address(
  process.env.PS_NONCE_PROGRAM_ID ?? "3nK4iiSeW7Mkx4GRxDXWWEw5H6ZPLG5yETB7JcZTdP5o"
);
