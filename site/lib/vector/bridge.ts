// Bridges vector-sdk's web3.js v3 (`Address`/`TransactionInstruction`) and the rest
// of the site's web3.js v1 (wallet-adapter, @solana/spl-token, the final Transaction
// that gets sent). The two classes share enough surface (`toBase58()`, raw bytes) to
// convert cleanly in one direction, and are safe to structurally cast in the other
// since vector-sdk's digest/passthrough code only ever reads `.programId`, `.keys`,
// and `.data` off an instruction — it never constructs or `instanceof`-checks one.
import { PublicKey as PublicKeyV1, TransactionInstruction as TransactionInstructionV1 } from "@solana/web3.js";
import { Address, type V3TransactionInstruction } from "./web3-v3";

export function toV1PublicKey(address: Address): PublicKeyV1 {
  return new PublicKeyV1(address.toBase58());
}

export function toV3Address(publicKey: PublicKeyV1): Address {
  return new Address(publicKey.toBase58());
}

/** Real conversion: a v3 instruction (from vector-sdk) into a v1 instruction the wallet can sign. */
export function toV1Instruction(ix: V3TransactionInstruction): TransactionInstructionV1 {
  return new TransactionInstructionV1({
    programId: toV1PublicKey(ix.programId),
    keys: ix.keys.map((meta) => ({
      pubkey: toV1PublicKey(meta.pubkey),
      isSigner: meta.isSigner,
      isWritable: meta.isWritable,
    })),
    data: Buffer.from(ix.data),
  });
}

/**
 * Type-only cast: a v1 instruction (from @solana/spl-token or SystemProgram) fed into
 * vector-sdk's digest/passthrough builders, which are typed against v3's
 * `TransactionInstruction` but only ever read public fields at runtime.
 */
export function asV3Instruction(ix: TransactionInstructionV1): V3TransactionInstruction {
  return ix as unknown as V3TransactionInstruction;
}
