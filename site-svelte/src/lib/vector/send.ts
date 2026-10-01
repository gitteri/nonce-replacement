// Mirrors solutions/vector/ts/lib/sendTx.ts's `skipPreflight: true` workaround for
// @solana/web3.js@3.0.0-rc.0's spurious preflight-simulation error — applied here to
// every send too, since the same rc's simulateTransaction bug isn't specific to which
// web3.js major version submits the transaction. Real on-chain failures still surface
// correctly via the post-submit confirmation status, which is checked explicitly below
// (neither `wallet.signTransaction` nor `connection.sendRawTransaction` throws on a
// transaction that lands but fails on-chain — only `connection.confirmTransaction`
// reports that, via a non-null `err`).
//
// Deliberately uses `wallet.signTransaction` + `sendRawTransaction` instead of a
// wallet's own `sendTransaction` convenience method. Several wallets (Phantom among
// them) prepend ComputeBudget instructions during their own send path for priority
// fees, which silently shifts every later instruction's index within the transaction.
// Vector's advance digest bakes in the *position* the advance instruction is expected
// to occupy (via the instructions-sysvar footer computed at sign time) — any wallet
// that reorders or inserts instructions invalidates every pre-signed digest. Signing
// only, then broadcasting the exact signed bytes ourselves, guarantees the instruction
// list that lands on-chain is byte-identical to what was signed.
import type { Connection, Keypair, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { Transaction } from '@solana/web3.js';
import type { WalletStore } from '$lib/wallet.svelte';

async function confirmOrThrow(
	connection: Connection,
	signature: string,
	blockhash: string,
	lastValidBlockHeight: number
): Promise<string> {
	const confirmation = await connection.confirmTransaction(
		{ signature, blockhash, lastValidBlockHeight },
		'confirmed'
	);
	if (confirmation.value.err) {
		throw new Error(
			`Transaction ${signature} failed on-chain: ${JSON.stringify(confirmation.value.err)}`
		);
	}
	return signature;
}

export async function sendV1(
	connection: Connection,
	wallet: WalletStore,
	instructions: TransactionInstruction[],
	extraSigners: Keypair[] = []
): Promise<string> {
	if (!wallet.publicKey) {
		throw new Error('Wallet not connected');
	}
	const feePayer: PublicKey = wallet.publicKey;

	const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
	const tx = new Transaction({ feePayer, blockhash, lastValidBlockHeight });
	tx.add(...instructions);
	if (extraSigners.length > 0) {
		tx.partialSign(...extraSigners);
	}

	const signed = await wallet.signTransaction(tx);
	const signature = await connection.sendRawTransaction(signed.serialize(), {
		skipPreflight: true
	});
	return confirmOrThrow(connection, signature, blockhash, lastValidBlockHeight);
}

/**
 * Same as sendV1, but signs and submits with a local Keypair instead of the connected
 * wallet — for demos that need a broadcaster provably unrelated to the visitor's wallet
 * (see Requirement 3: fee-payer separation).
 */
export async function sendWithKeypair(
	connection: Connection,
	payer: Keypair,
	instructions: TransactionInstruction[],
	extraSigners: Keypair[] = []
): Promise<string> {
	const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
	const tx = new Transaction({ feePayer: payer.publicKey, blockhash, lastValidBlockHeight });
	tx.add(...instructions);
	tx.sign(payer, ...extraSigners);

	const signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true });
	return confirmOrThrow(connection, signature, blockhash, lastValidBlockHeight);
}
