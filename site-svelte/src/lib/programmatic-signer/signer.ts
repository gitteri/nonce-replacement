// Browser port of solutions/programmatic-signer/ts/lib/programmaticSigner.ts. Same message
// layout and signing, with the cold key held as raw bytes and signed with noble instead of
// a WebCrypto key, and program ids passed in rather than read from process.env.
import { ed25519 } from "@noble/curves/ed25519.js";
import {
  AccountRole,
  appendTransactionMessageInstructions,
  compileTransactionMessage,
  createNoopSigner,
  createTransactionMessage,
  getAddressDecoder,
  getCompiledTransactionMessageEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  type Address,
  type Blockhash,
  type CompiledTransactionMessage,
  type Instruction,
  type ReadonlyUint8Array,
} from "@solana/kit";
import {
  findProgrammaticSignerPda,
  getExecuteInstruction,
  getInitializeInstruction,
  getNonceDecoder,
  getSubmitInstruction,
} from "../../../vendor/ed25519-programmatic-signer/src/index";

export type ProgramIds = { signer: Address; executor: Address; nonce: Address };

export type ColdKey = { address: Address; secretKey: Uint8Array };

const ZERO_LIFETIME = "11111111111111111111111111111111" as Blockhash;
const messageEncoder = getCompiledTransactionMessageEncoder();
const addressDecoder = getAddressDecoder();
const nonceDecoder = getNonceDecoder();

export const NONCE_ACCOUNT_SPACE = nonceDecoder.fixedSize;

export function coldKeyFromSecret(secretKey: Uint8Array): ColdKey {
  return { address: addressDecoder.decode(ed25519.getPublicKey(secretKey)), secretKey };
}

/** A fresh cold key. It never pays or signs a transaction, only authorization messages. */
export function generateColdKey(): ColdKey {
  return coldKeyFromSecret(ed25519.utils.randomSecretKey());
}

export async function programmaticSigner(ids: ProgramIds, cold: Address): Promise<Address> {
  const [pda] = await findProgrammaticSignerPda({ authority: cold }, { programAddress: ids.signer });
  return pda;
}

/** The user's instructions as a v1 message, with the expected nonce where a blockhash would go. */
export function compileExecutionMessage(
  pda: Address,
  nonce: Address,
  payload: Instruction[]
): ReadonlyUint8Array {
  const message = pipe(
    createTransactionMessage({ version: 1 }),
    (m) => setTransactionMessageFeePayer(pda, m),
    (m) =>
      setTransactionMessageLifetimeUsingBlockhash(
        { blockhash: nonce as string as Blockhash, lastValidBlockHeight: 0n },
        m
      ),
    (m) => appendTransactionMessageInstructions(payload, m)
  );
  return messageEncoder.encode(compileTransactionMessage(message));
}

/** Port of `signer/client/src/message.rs::authorization_message` for a single authority. */
export function compileAuthorizationMessage(
  authority: Address,
  executorIx: Instruction
): ReadonlyUint8Array {
  const accounts = executorIx.accounts ?? [];
  const isWritable = (role: AccountRole) =>
    role === AccountRole.WRITABLE || role === AccountRole.WRITABLE_SIGNER;
  const writable: Address[] = [];
  const readonly: Address[] = [];
  for (const meta of accounts) {
    if (meta.address === authority || meta.address === executorIx.programAddress) continue;
    const bucket = isWritable(meta.role) ? writable : readonly;
    if (!bucket.includes(meta.address)) bucket.push(meta.address);
  }
  const readonlyOnly = readonly.filter((address) => !writable.includes(address));
  const staticAccounts = [authority, ...writable, executorIx.programAddress, ...readonlyOnly];
  const indexOf = (address: Address) => staticAccounts.indexOf(address);
  const data = executorIx.data ?? new Uint8Array();

  const message = {
    version: 1,
    header: {
      numSignerAccounts: 1,
      numReadonlySignerAccounts: 0,
      numReadonlyNonSignerAccounts: readonlyOnly.length + 1,
    },
    configMask: 0,
    configValues: [],
    lifetimeToken: ZERO_LIFETIME,
    numInstructions: 1,
    numStaticAccounts: staticAccounts.length,
    staticAccounts,
    instructionHeaders: [
      {
        programAccountIndex: indexOf(executorIx.programAddress),
        numInstructionAccounts: accounts.length,
        numInstructionDataBytes: data.length,
      },
    ],
    instructionPayloads: [
      {
        instructionAccountIndices: accounts.map((meta) => indexOf(meta.address)),
        instructionData: data,
      },
    ],
  } as CompiledTransactionMessage;
  return messageEncoder.encode(message);
}

export type Presigned = {
  submit: Instruction;
  executionMessage: ReadonlyUint8Array;
  authorizationMessage: ReadonlyUint8Array;
  signature: ReadonlyUint8Array;
};

/** Signs `payload` against `nonce` on `nonceAccount` without reading chain state. */
export async function presign(
  ids: ProgramIds,
  cold: ColdKey,
  nonceAccount: Address,
  nonce: Address,
  payload: Instruction[]
): Promise<Presigned> {
  const pda = await programmaticSigner(ids, cold.address);
  const executionMessage = compileExecutionMessage(pda, nonce, payload);
  const executorIx = getExecuteInstruction(
    {
      message: executionMessage,
      nonceAccount,
      nonceAuthority: createNoopSigner(pda),
      nonceProgram: ids.nonce,
    },
    { programAddress: ids.executor }
  );
  const authorizationMessage = compileAuthorizationMessage(cold.address, executorIx);
  const signature = ed25519.sign(authorizationMessage as Uint8Array, cold.secretKey);
  const submit = getSubmitInstruction(
    { signatures: [signature], message: authorizationMessage },
    { programAddress: ids.signer }
  );
  return { submit, executionMessage, authorizationMessage, signature };
}

export function initializeNonceInstruction(
  ids: ProgramIds,
  nonceAccount: Address,
  authority: Address
): Instruction {
  return getInitializeInstruction({ nonceAccount, authority }, { programAddress: ids.nonce });
}

export function decodeStoredNonce(data: Uint8Array): Address {
  return nonceDecoder.decode(data).nonce;
}
