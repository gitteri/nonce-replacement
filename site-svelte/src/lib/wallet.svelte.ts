// Hand-rolled Solana wallet connection for Svelte 5, built directly on the
// actively-maintained, framework-agnostic Wallet Standard packages rather than any
// Svelte-specific wrapper (both existing ones are unsuitable: @svelte-on-solana's
// packages are unmaintained since 2022 and pin svelte@^3; @bewinxed's Svelte-5-native
// alternative is a 7-commit experimental project with an undocumented signTransaction
// story — exactly what this app depends on most).
//
// StandardWalletAdapter is the same adapter class @solana/wallet-adapter-react uses
// internally, so its .publicKey/.connected/.connect()/.signTransaction() surface is
// proven. It's a plain EventEmitter, not itself reactive — connect/disconnect must be
// mirrored into this store's own $state fields, or Svelte won't know to re-render when
// a wallet connects asynchronously after a button click.
import { browser } from '$app/environment';
import { isWalletAdapterCompatibleStandardWallet } from '@solana/wallet-adapter-base';
import { StandardWalletAdapter } from '@solana/wallet-standard-wallet-adapter-base';
import { getWallets } from '@wallet-standard/app';
import type { PublicKey, Transaction } from '@solana/web3.js';

class WalletStore {
	wallets = $state<StandardWalletAdapter[]>([]);
	selected = $state<StandardWalletAdapter | null>(null);
	publicKeyState = $state<PublicKey | null>(null);
	connectedState = $state(false);
	connecting = $state(false);
	error = $state<string | null>(null);

	constructor() {
		if (!browser) return;
		const { get, on } = getWallets();
		const sync = () => {
			this.wallets = get()
				.filter(isWalletAdapterCompatibleStandardWallet)
				.map((w) => new StandardWalletAdapter({ wallet: w }));
		};
		sync();
		on('register', sync);
		on('unregister', sync);
	}

	get publicKey(): PublicKey | null {
		return this.publicKeyState;
	}

	get connected(): boolean {
		return this.connectedState;
	}

	select(adapter: StandardWalletAdapter) {
		this.selected?.removeAllListeners();
		this.selected = adapter;
		this.publicKeyState = adapter.publicKey;
		this.connectedState = adapter.connected;
		adapter.on('connect', (publicKey) => {
			this.publicKeyState = publicKey;
			this.connectedState = true;
		});
		adapter.on('disconnect', () => {
			this.publicKeyState = null;
			this.connectedState = false;
		});
		adapter.on('error', (err) => {
			this.error = err.message;
		});
	}

	async selectAndConnect(adapter: StandardWalletAdapter) {
		this.select(adapter);
		await this.connect();
	}

	async connect() {
		if (!this.selected) return;
		this.connecting = true;
		this.error = null;
		try {
			await this.selected.connect();
			this.publicKeyState = this.selected.publicKey;
			this.connectedState = this.selected.connected;
		} catch (err) {
			this.error = err instanceof Error ? err.message : String(err);
		} finally {
			this.connecting = false;
		}
	}

	async disconnect() {
		await this.selected?.disconnect();
		this.publicKeyState = null;
		this.connectedState = false;
	}

	async signTransaction(tx: Transaction): Promise<Transaction> {
		if (!this.selected?.signTransaction) {
			throw new Error('Connected wallet does not support signing transactions directly');
		}
		return this.selected.signTransaction(tx);
	}
}

export const wallet = new WalletStore();
export type { WalletStore };
