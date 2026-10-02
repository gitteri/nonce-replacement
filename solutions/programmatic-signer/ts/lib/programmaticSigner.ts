/**
 * Offline signing for Ed25519 Programmatic Signer, built on the upstream Codama client vendored at
 * `e3c948d` (`vendor/ed25519-programmatic-signer`). The client ships instruction builders only, so
 * this module adds what the Rust client's `presign` path does: compile the execution message,
 * wrap it in an authorization message, and sign that with the cold key.
 */
import {
  AccountRole,
  appendTransactionMessageInstructions,
  compileTransactionMessage,
  createKeyPairFromPrivateKeyBytes,
  createNoopSigner,
  createTransactionMessage,
  getAddressDecoder,
  getAddressEncoder,
  getCompiledTransactionMessageEncoder,
  pipe,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signBytes,
  type Address,
  type Blockhash,
  type CompiledTransactionMessage,
  type Instruction,
  type ReadonlyUint8Array,
  type Rpc,
  type SolanaRpcApi,
  type TransactionSigner,
} from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import { createHash } from "node:crypto";
import {
  fetchNonce,
  findProgrammaticSignerPda,
  getExecuteInstruction,
  getInitializeInstruction,
  getNonceDecoder,
  getSubmitInstruction,
} from "../vendor/ed25519-programmatic-signer/src/index.js";
import { EXECUTOR_PROGRAM, NONCE_PROGRAM, SIGNER_PROGRAM } from "./programs.js";

export { EXECUTOR_PROGRAM, NONCE_PROGRAM, SIGNER_PROGRAM };

const NONCE_STEP_TAG = new TextEncoder().encode("spl-nonce::step::v1");
const ZERO_LIFETIME = "11111111111111111111111111111111" as Blockhash;
const messageEncoder = getCompiledTransactionMessageEncoder();
const addressEncoder = getAddressEncoder();
const addressDecoder = getAddressDecoder();

export type ColdKey = {
  address: Address;
  keyPair: Awaited<ReturnType<typeof createKeyPairFromPrivateKeyBytes>>;
};

export async function programmaticSigner(cold: Address): Promise<Address> {
  const [pda] = await findProgrammaticSignerPda({ authority: cold }, { programAddress: SIGNER_PROGRAM });
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

/**
 * Port of `signer/client/src/message.rs::authorization_message` for a single authority. Key order
 * is the authority, writable accounts, the Executor program id, then readonly accounts, and signer
 * flags on the executor instruction's accounts are dropped.
 */
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

  const message: CompiledTransactionMessage = {
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
  cold: ColdKey,
  nonceAccount: Address,
  nonce: Address,
  payload: Instruction[]
): Promise<Presigned> {
  const pda = await programmaticSigner(cold.address);
  const executionMessage = compileExecutionMessage(pda, nonce, payload);
  const executorIx = getExecuteInstruction(
    {
      message: executionMessage,
      nonceAccount,
      nonceAuthority: createNoopSigner(pda),
      nonceProgram: NONCE_PROGRAM,
    },
    { programAddress: EXECUTOR_PROGRAM }
  );
  const authorizationMessage = compileAuthorizationMessage(cold.address, executorIx);
  const signature = await signBytes(cold.keyPair.privateKey, authorizationMessage);
  const submit = getSubmitInstruction(
    { signatures: [signature], message: authorizationMessage },
    { programAddress: SIGNER_PROGRAM }
  );
  return { submit, executionMessage, authorizationMessage, signature };
}

const sha256 = (...parts: ReadonlyUint8Array[]) => {
  const hash = createHash("sha256");
  for (const part of parts) hash.update(part as Uint8Array);
  return new Uint8Array(hash.digest());
};

/** The value `nonceAccount` holds after `executionMessage` lands at `current`. */
export function nextNonce(
  nonceAccount: Address,
  current: Address,
  executionMessage: ReadonlyUint8Array
): Address {
  const next = sha256(
    NONCE_STEP_TAG,
    addressEncoder.encode(NONCE_PROGRAM),
    addressEncoder.encode(nonceAccount),
    addressEncoder.encode(current),
    sha256(executionMessage)
  );
  return addressDecoder.decode(next);
}

/** Create and initialize a nonce account whose authority is `authority`. */
export async function createNonceAccountInstructions(
  rpc: Rpc<SolanaRpcApi>,
  payer: TransactionSigner,
  nonceAccount: TransactionSigner,
  authority: Address
): Promise<Instruction[]> {
  const space = getNonceDecoder().fixedSize;
  const rent = await rpc.getMinimumBalanceForRentExemption(BigInt(space)).send();
  return [
    getCreateAccountInstruction({
      payer,
      newAccount: nonceAccount,
      lamports: rent,
      space,
      programAddress: NONCE_PROGRAM,
    }),
    getInitializeInstruction(
      { nonceAccount: nonceAccount.address, authority },
      { programAddress: NONCE_PROGRAM }
    ),
  ];
}

export async function fetchStoredNonce(rpc: Rpc<SolanaRpcApi>, nonceAccount: Address): Promise<Address> {
  const account = await fetchNonce(rpc, nonceAccount, { commitment: "confirmed" });
  return account.data.nonce;
}
