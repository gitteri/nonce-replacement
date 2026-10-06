import {
  appendTransactionMessageInstructions,
  assertIsTransactionWithBlockhashLifetime,
  createTransactionMessage,
  getSignatureFromTransaction,
  isSolanaError,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR,
  type Instruction,
  type Signature,
  type TransactionSigner,
} from "@solana/kit";
import type { Devnet } from "./connection.js";

/** Lands `instructions` in one transaction paid for by `feePayer`, signed by any signers they carry. */
export async function sendTx(
  { rpc, rpcSubscriptions }: Devnet,
  feePayer: TransactionSigner,
  instructions: Instruction[]
): Promise<Signature> {
  const { value: latestBlockhash } = await rpc.getLatestBlockhash({ commitment: "confirmed" }).send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(feePayer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m)
  );
  const transaction = await signTransactionMessageWithSigners(message);
  assertIsTransactionWithBlockhashLifetime(transaction);
  const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
  for (let attempt = 1; ; attempt++) {
    try {
      await sendAndConfirm(transaction, { commitment: "confirmed" });
      return getSignatureFromTransaction(transaction);
    } catch (err) {
      if (
        !isSolanaError(err, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR) ||
        err.context.statusCode !== 429 ||
        attempt === 5
      ) {
        throw err;
      }
      const retryAfter = Number(err.context.headers.get("retry-after")) || 2;
      await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
    }
  }
}

/** Rethrows RPC transport errors, so a rejection check only passes on an onchain failure. */
export function assertRejectedOnchain(err: unknown): void {
  if (isSolanaError(err, SOLANA_ERROR__RPC__TRANSPORT_HTTP_ERROR)) throw err;
}
