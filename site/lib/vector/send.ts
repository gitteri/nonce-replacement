// Mirrors solutions/vector/ts/lib/sendTx.ts's `skipPreflight: true` workaround for
// @solana/web3.js@3.0.0-rc.0's spurious preflight-simulation error — applied here to
// every wallet-adapter send too, since the same rc's simulateTransaction bug isn't
// specific to which web3.js major version submits the transaction. Real on-chain
// failures still surface correctly via the post-submit confirmation status, which is
// checked explicitly below (wallet-adapter's own `sendTransaction` does not throw on
// a transaction that lands but fails on-chain — only `connection.confirmTransaction`
// reports that, via a non-null `err`).
import type { Connection, Keypair, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { Transaction } from "@solana/web3.js";
import type { WalletContextState } from "@solana/wallet-adapter-react";

export async function sendV1(
  connection: Connection,
  wallet: WalletContextState,
  instructions: TransactionInstruction[],
  extraSigners: Keypair[] = []
): Promise<string> {
  if (!wallet.publicKey) {
    throw new Error("Wallet not connected");
  }
  const feePayer: PublicKey = wallet.publicKey;

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
  const tx = new Transaction({ feePayer, blockhash, lastValidBlockHeight });
  tx.add(...instructions);
  if (extraSigners.length > 0) {
    tx.partialSign(...extraSigners);
  }

  const signature = await wallet.sendTransaction(tx, connection, { skipPreflight: true });
  const confirmation = await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  if (confirmation.value.err) {
    throw new Error(
      `Transaction ${signature} failed on-chain: ${JSON.stringify(confirmation.value.err)}`
    );
  }
  return signature;
}
