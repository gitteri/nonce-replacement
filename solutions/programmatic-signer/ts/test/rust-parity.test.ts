/**
 * Pins the TS signing path to bytes produced by the Rust client's `presign` (rust/tests/common)
 * for cold key [7; 32], nonce account [2; 32], nonce [0xab; 32] and a 1,000 lamport transfer from
 * the programmatic signer to [3; 32].
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createKeyPairFromPrivateKeyBytes,
  createNoopSigner,
  getAddressDecoder,
  getAddressFromPublicKey,
} from "@solana/kit";
import { getTransferSolInstruction } from "@solana-program/system";
import { nextNonce, presign, programmaticSigner } from "../lib/programmaticSigner.js";

const RUST = {
  pda: "DPtajHyTTrmEHk3MnyfWVCypdEdyjk1ESbK7UxbaxXqw",
  execution:
    "8101000100000000abababababababababababababababababababababababababababababababab0103b82958271684f0f7c55f417177712d221bf9657accb06ffff8d98cf87d618f760303030303030303030303030303030303030303030303030303030303030303000000000000000000000000000000000000000000000000000000000000000002020c00000102000000e803000000000000",
  submitData:
    "00018d5cb37002b8d0cfb2b9f865f8f29ad132017f57b4b2b53c512841b293ccfc9d15d8a46c7d9a3181a90fa0c53ea7ca34335ca03ed210b9cca5367cf7352da803810100030000000000000000000000000000000000000000000000000000000000000000000000000107ea4a6c63e29c520abef5507b132ec5f9954776aebebe7b92421eea691446d22c0202020202020202020202020202020202020202020202020202020202020202b82958271684f0f7c55f417177712d221bf9657accb06ffff8d98cf87d618f760303030303030303030303030303030303030303030303030303030303030303cf69695f8f9258b8ad5234ea6bfbe4af583b83b47a28da10cb6740c860541c380596193e6b1bd7cbc0372bc3e9e082aef5d0f97e417840f0329633d681bd566c000000000000000000000000000000000000000000000000000000000000000004069d00020105020306008101000100000000abababababababababababababababababababababababababababababababab0103b82958271684f0f7c55f417177712d221bf9657accb06ffff8d98cf87d618f760303030303030303030303030303030303030303030303030303030303030303000000000000000000000000000000000000000000000000000000000000000002020c00000102000000e803000000000000",
  submitAccounts: [
    "GmaDrppBC7P5ARKV8g3djiwP89vz1jLK23V2GBjuAEGB",
    "8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR",
    "DPtajHyTTrmEHk3MnyfWVCypdEdyjk1ESbK7UxbaxXqw",
    "CktRuQ2mttgRGkXJtyksdKHjUdc2C4TgDzyB98oEzy8",
    "ExecxgyHYsAXB4c5dZodV1zJZ9hqfsDCYkRDRATrpkFR",
    "Noncediea1fH12usShuQAz28UhgAeuE5Maf32LsMUQB",
    "11111111111111111111111111111111",
  ],
  next: "G75T7bmPbbuQ3y5tje5jr3n2NSaQT3q7Puz3t4y8ia5z",
};

const hex = (bytes: ArrayLike<number>) => Buffer.from(Uint8Array.from(bytes)).toString("hex");
const address = (byte: number) => getAddressDecoder().decode(new Uint8Array(32).fill(byte));

test("presign matches the Rust client byte for byte", async () => {
  const keyPair = await createKeyPairFromPrivateKeyBytes(new Uint8Array(32).fill(7));
  const cold = { address: await getAddressFromPublicKey(keyPair.publicKey), keyPair };
  const pda = await programmaticSigner(cold.address);
  assert.equal(pda, RUST.pda);

  const transfer = getTransferSolInstruction({
    source: createNoopSigner(pda),
    destination: address(3),
    amount: 1000n,
  });
  const presigned = await presign(cold, address(2), address(0xab), [transfer]);

  assert.equal(hex(presigned.executionMessage), RUST.execution);
  assert.equal(hex(presigned.submit.data!), RUST.submitData);
  assert.deepEqual(
    presigned.submit.accounts!.map((meta) => meta.address),
    RUST.submitAccounts
  );
  assert.equal(nextNonce(address(2), address(0xab), presigned.executionMessage), RUST.next);
});
