/**
 * Requirement 7 — Transaction Parsability (requirements/nonce-replacement-spec.md).
 *
 * A policy engine receives only the Submit instruction. This peels it apart with stock Kit codecs:
 * Submit data, then the authorization message (a v1 message), then the Execute instruction inside
 * it, then the execution message (another v1 message), then the user's instructions. It checks the
 * signature offline, decodes the transfer, and only then lands it.
 */
import {
  SYSTEM_PROGRAM_ADDRESS,
  SystemInstruction,
  getTransferSolInstruction,
  identifySystemInstruction,
  parseTransferSolInstruction,
} from "@solana-program/system";
import {
  createNoopSigner,
  decompileTransactionMessage,
  getCompiledTransactionMessageDecoder,
  getPublicKeyFromAddress,
  verifySignature,
  type CompiledTransactionMessage,
  type CompiledTransactionMessageWithLifetime,
  type ReadonlyUint8Array,
  type SignatureBytes,
} from "@solana/kit";
import { devnetRpc } from "../lib/connection.js";
import { ensureFunded, loadFunderKeypair, loadOrGenerateKeypair } from "../lib/keypair.js";
import { logTx, section } from "../lib/format.js";
import { MESSAGE_EXECUTOR_PROGRAM_ADDRESS, fetchStoredNonce, presign } from "../lib/programmaticSigner.js";
import { sendTx } from "../lib/sendTx.js";
import { setupSigner } from "../lib/setup.js";
import {
  getExecuteInstructionDataDecoder,
  getSubmitInstructionDataDecoder,
} from "../vendor/ed25519-programmatic-signer/src/index.js";

type V1Message = Extract<CompiledTransactionMessage, { version: 1 }> & CompiledTransactionMessageWithLifetime;
const decodeV1 = (bytes: ReadonlyUint8Array) => {
  const message = getCompiledTransactionMessageDecoder().decode(bytes);
  if (message.version !== 1) throw new Error(`expected a v1 message, got ${message.version}`);
  return message as V1Message;
};

async function main() {
  const devnet = devnetRpc();
  const funder = await loadFunderKeypair();
  const relayer = await loadOrGenerateKeypair(".devnet/07-relayer.keypair.json");
  await ensureFunded(devnet, relayer, 0.006e9, funder);

  section("Setup and sign");
  const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(devnet, relayer, {
    pdaLamports: 2_000_000n,
  });
  logTx("setup", setupSignature);
  const nonce = await fetchStoredNonce(devnet.rpc, nonceAccounts[0]);
  const { submit } = await presign(cold, nonceAccounts[0], nonce, [
    getTransferSolInstruction({ source: createNoopSigner(pda), destination: relayer.address, amount: 1_000n }),
  ]);

  section("Layer 1: Submit instruction data");
  const { signatures, message: authorizationBytes } = getSubmitInstructionDataDecoder().decode(submit.data!);
  console.log(`${signatures.length} signature(s) over a ${authorizationBytes.length} byte authorization message`);

  section("Layer 2: authorization message");
  const authorization = decodeV1(authorizationBytes);
  const signers = authorization.staticAccounts.slice(0, authorization.header.numSignerAccounts);
  for (const [i, signer] of signers.entries()) {
    const ok = await verifySignature(
      await getPublicKeyFromAddress(signer),
      signatures[i] as SignatureBytes,
      authorizationBytes
    );
    console.log(`signer ${signer}: signature ${ok ? "valid" : "INVALID"}`);
    if (!ok) process.exit(1);
  }
  const [header] = authorization.instructionHeaders;
  const [payload] = authorization.instructionPayloads;
  const program = authorization.staticAccounts[header.programAccountIndex];
  console.log(`one instruction, to ${program === MESSAGE_EXECUTOR_PROGRAM_ADDRESS ? "the Message Executor" : program}`);

  section("Layer 3: execution message");
  const { message: executionBytes } = getExecuteInstructionDataDecoder().decode(payload.instructionData);
  const execution = decodeV1(executionBytes);
  console.log(`expected nonce (lifetime slot): ${execution.lifetimeToken}`);
  console.log(`acting as: ${execution.staticAccounts[0]} (the cold key's programmatic signer)`);

  section("Layer 4: the user's instructions");
  const { instructions } = decompileTransactionMessage(execution);
  for (const instruction of instructions) {
    const { programAddress, data } = instruction;
    if (
      programAddress === SYSTEM_PROGRAM_ADDRESS &&
      data &&
      identifySystemInstruction(data) === SystemInstruction.TransferSol
    ) {
      const parsed = parseTransferSolInstruction(instruction as Parameters<typeof parseTransferSolInstruction>[0]);
      console.log(
        `System transfer: ${parsed.data.amount} lamports ${parsed.accounts.source.address} -> ${parsed.accounts.destination.address}`
      );
    } else {
      console.log(`instruction to ${programAddress}`);
    }
  }

  section("Policy passed, land it");
  logTx("submit", await sendTx(devnet, relayer, [submit]));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
