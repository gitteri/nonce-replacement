// The Programmatic Signer client builds @solana/kit instructions, while the wallet and
// sendV1 work in web3.js v1. Converting at send time keeps one send path for both tracks.
import { isSignerRole, isWritableRole, type Instruction } from "@solana/kit";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";

export function toV1Instruction(ix: Instruction): TransactionInstruction {
  return new TransactionInstruction({
    programId: new PublicKey(ix.programAddress),
    keys: (ix.accounts ?? []).map((meta) => ({
      pubkey: new PublicKey(meta.address),
      isSigner: isSignerRole(meta.role),
      isWritable: isWritableRole(meta.role),
    })),
    data: Buffer.from(ix.data ?? new Uint8Array()),
  });
}
