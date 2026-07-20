import {
  Connection,
  Keypair,
  Transaction,
  TransactionSignature,
  sendAndConfirmTransaction,
} from "@solana/web3.js";

/**
 * `@solana/web3.js@3.0.0-rc.0`'s default preflight `simulateTransaction` path
 * throws a spurious `SendTransactionError` even on successful simulations
 * (a bug in this rc — the thrown message embeds the program's own "success"
 * log line). Skipping preflight avoids it; real on-chain failures still
 * surface correctly via the post-submit confirmation status.
 */
export async function sendTx(
  connection: Connection,
  tx: Transaction,
  signers: Keypair[]
): Promise<TransactionSignature> {
  return sendAndConfirmTransaction(connection, tx, signers, { skipPreflight: true });
}
