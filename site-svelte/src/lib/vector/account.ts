// Reads the on-chain VectorAccount (nonce + bump) through the site's own v1
// Connection (the one wallet-adapter already provides via useConnection()), instead
// of constructing a second, v3-typed Connection just to satisfy vector-sdk's
// `fetchVectorAccount` signature. `deserializeVectorAccount` is a pure byte-parsing
// function with no web3.js-version dependency, so this is a drop-in equivalent.
import { Connection, PublicKey } from "@solana/web3.js";
import { deserializeVectorAccount, findVectorPda, type VectorAccount } from "vector-sdk";
import { ED25519_DEVNET } from "./vectorProgram";
import { toV1PublicKey } from "./bridge";

export function vectorPdaV1(identity: Uint8Array): PublicKey {
  const [pda] = findVectorPda(ED25519_DEVNET, identity);
  return toV1PublicKey(pda);
}

export async function fetchVectorAccountV1(
  connection: Connection,
  identity: Uint8Array
): Promise<VectorAccount> {
  const pda = vectorPdaV1(identity);
  const info = await connection.getAccountInfo(pda);
  if (!info) {
    throw new Error("Vector account not found");
  }
  return deserializeVectorAccount(info.data);
}

export function hex(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("hex");
}
