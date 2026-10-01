// Several wallets (Phantom among them) auto-inject ComputeBudget instructions ahead
// of whatever a dApp asks them to sign, for priority fees — a behavior that happens at
// signing time regardless of which wallet-adapter method is used, and persists even
// when a transaction already contains no ComputeBudget instructions.
//
// This breaks Vector's advance digest, which bakes in the *position* the advance
// instruction is expected to occupy (via the instructions-sysvar footer computed at
// sign time — see advanceVectorDigest's preInstructions parameter). If the wallet
// silently prepends instructions, the position it actually lands at no longer matches
// what was signed, and the on-chain digest recompute fails.
//
// The fix: prepend our own ComputeBudget instructions before anything wallet-signed.
// Most wallets' heuristic for adding their own is "only if the transaction doesn't
// already have one" — supplying both up front (limit + price) satisfies that check and
// stops the injection, while `advanceVectorDigest`'s preInstructions parameter (its
// doc comment even names a compute-budget bump as the canonical use case) lets us
// account for them in the signed digest so what's signed matches what's broadcast.
import { ComputeBudgetProgram, type TransactionInstruction } from "@solana/web3.js";
import { asV3Instruction } from "./bridge";
import type { V3TransactionInstruction } from "./web3-v3";

export interface ComputeBudgetGuard {
  v1: TransactionInstruction[];
  v3: V3TransactionInstruction[];
}

export function computeBudgetGuard(): ComputeBudgetGuard {
  const v1 = [
    ComputeBudgetProgram.setComputeUnitLimit({ units: 200_000 }),
    ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1 }),
  ];
  return { v1, v3: v1.map(asV3Instruction) };
}
