<script lang="ts">
	import { wallet } from '$lib/wallet.svelte';

	let open = $state(false);

	function truncate(base58: string): string {
		return `${base58.slice(0, 4)}..${base58.slice(-4)}`;
	}

	async function disconnect() {
		await wallet.disconnect();
	}
</script>

<div class="relative">
	{#if wallet.connected && wallet.publicKey}
		<button
			type="button"
			onclick={disconnect}
			class="w-full rounded-md border border-neutral-300 px-3 py-2 text-left text-sm dark:border-neutral-700"
		>
			{truncate(wallet.publicKey.toBase58())}
			<span class="text-neutral-500">(disconnect)</span>
		</button>
	{:else}
		<button
			type="button"
			onclick={() => (open = !open)}
			disabled={wallet.connecting}
			class="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
		>
			{wallet.connecting ? 'Connecting…' : 'Connect Wallet'}
		</button>

		{#if open}
			<div
				class="absolute z-10 mt-1 w-full rounded-md border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
			>
				{#if wallet.wallets.length === 0}
					<div class="px-3 py-2 text-sm text-neutral-500">No wallet detected</div>
				{:else}
					{#each wallet.wallets as adapter (adapter.name)}
						<button
							type="button"
							onclick={async () => {
								open = false;
								await wallet.selectAndConnect(adapter);
							}}
							class="block w-full px-3 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
						>
							{adapter.name}
						</button>
					{/each}
				{/if}
			</div>
		{/if}
	{/if}

	{#if wallet.error}
		<p class="mt-1 text-xs text-red-600 dark:text-red-400">{wallet.error}</p>
	{/if}
</div>
