// Browser port of the decode in solutions/programmatic-signer/ts/scripts/07-parsability.ts.
// Peels a Submit instruction apart with stock Kit codecs, checking signatures with noble.
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  decompileTransactionMessage,
  getAddressEncoder,
  getCompiledTransactionMessageDecoder,
  type Address,
  type CompiledTransactionMessage,
  type CompiledTransactionMessageWithLifetime,
  type Instruction,
  type ReadonlyUint8Array,
  unwrapOption,
} from "@solana/kit";
import {
  getExecuteInstructionDataDecoder,
  getSubmitInstructionDataDecoder,
} from "../../../vendor/ed25519-programmatic-signer/src/index";

type V1Message = Extract<CompiledTransactionMessage, { version: 1 }> & CompiledTransactionMessageWithLifetime;

function decodeV1(bytes: ReadonlyUint8Array): V1Message {
  const message = getCompiledTransactionMessageDecoder().decode(bytes);
  if (message.version !== 1) throw new Error(`expected a v1 message, got ${message.version}`);
  return message as V1Message;
}

export type DecodedSubmit = {
  authorizationBytes: number;
  signers: { address: Address; valid: boolean }[];
  program: Address;
  expectedNonce: string;
  actingAs: Address;
  instructions: readonly Instruction[];
};

export function decodeSubmit(submitData: ReadonlyUint8Array): DecodedSubmit {
  const { signatures, message: authorizationBytes } = getSubmitInstructionDataDecoder().decode(submitData);
  const authorization = decodeV1(authorizationBytes);
  const addressEncoder = getAddressEncoder();
  const signers = authorization.staticAccounts
    .slice(0, authorization.header.numSignerAccounts)
    .map((address, i) => {
      const signature = unwrapOption(signatures[i]);
      return {
        address,
        valid:
          signature !== null &&
          ed25519.verify(
            signature as Uint8Array,
            authorizationBytes as Uint8Array,
            addressEncoder.encode(address) as Uint8Array
          ),
      };
    });

  const [header] = authorization.instructionHeaders;
  const [payload] = authorization.instructionPayloads;
  const { message: executionBytes } = getExecuteInstructionDataDecoder().decode(payload.instructionData);
  const execution = decodeV1(executionBytes);

  return {
    authorizationBytes: authorizationBytes.length,
    signers,
    program: authorization.staticAccounts[header.programAccountIndex],
    expectedNonce: execution.lifetimeToken,
    actingAs: execution.staticAccounts[0],
    instructions: decompileTransactionMessage(execution).instructions,
  };
}
