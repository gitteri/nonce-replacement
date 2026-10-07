import { address } from "@solana/kit";

/** Anza's canonical devnet program ids. Override all three to target another deployment. */
export const SIGNER_PROGRAM = address(
  process.env.PS_SIGNER_PROGRAM_ID ?? "EdSigVfK1DkeMrjFNDMjwfQaJPhPTtX7jW8uPv3oKEgN"
);
export const EXECUTOR_PROGRAM = address(
  process.env.PS_EXECUTOR_PROGRAM_ID ?? "ExecxgyHYsAXB4c5dZodV1zJZ9hqfsDCYkRDRATrpkFR"
);
export const NONCE_PROGRAM = address(
  process.env.PS_NONCE_PROGRAM_ID ?? "Noncediea1fH12usShuQAz28UhgAeuE5Maf32LsMUQB"
);
