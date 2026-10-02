// The Programmatic Signer client builds @solana/kit instructions, while the wallet and
// sendV1 work in web3.js v1. Converting at send time keeps one send path for both tracks.
import { AccountRole, address, isSignerRole, isWritableRole, type Instruction } from "@solana/kit";
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

/** For payloads built with web3.js v1 helpers like @solana/spl-token. */
export function fromV1Instruction(ix: TransactionInstruction): Instruction {
  const roles = [
    [AccountRole.READONLY, AccountRole.WRITABLE],
    [AccountRole.READONLY_SIGNER, AccountRole.WRITABLE_SIGNER],
  ];
  return {
    programAddress: address(ix.programId.toBase58()),
    accounts: ix.keys.map((meta) => ({
      address: address(meta.pubkey.toBase58()),
      role: roles[+meta.isSigner][+meta.isWritable],
    })),
    data: new Uint8Array(ix.data),
  };
}
