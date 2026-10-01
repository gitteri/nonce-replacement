<script lang="ts">
	import { base } from '$app/paths';
</script>

<main class="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-24">
	<p class="text-sm font-medium uppercase tracking-wide text-neutral-500">Nonce Replacement</p>
	<h1 class="mt-3 text-4xl font-semibold tracking-tight">
		Replacing durable nonce accounts, requirement by requirement
	</h1>
	<p class="mt-4 text-lg text-neutral-600 dark:text-neutral-400">
		Institutional custodians need pre-signed Solana transactions that survive longer than a
		blockhash allows, without giving up integrity, revocability, or fee-payer flexibility. This
		site walks through 9 functional requirements and shows, live on devnet, how each candidate
		solution measures up.
	</p>

	<div class="mt-10 grid gap-4 sm:grid-cols-2">
		<a
			href="{base}/vector"
			class="rounded-lg border border-neutral-200 p-5 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
		>
			<div class="font-medium">Vector</div>
			<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
				Blueshift&apos;s hashchain-based offline-signing program. Live now.
			</p>
		</a>
		<div class="rounded-lg border border-dashed border-neutral-300 p-5 text-neutral-400 dark:border-neutral-700">
			<div class="font-medium">ed25519-programmatic-signer</div>
			<p class="mt-1 text-sm">Anza&apos;s in-development program. Coming soon.</p>
		</div>
	</div>

	<p class="mt-10 text-sm text-neutral-500">
		<a href="https://github.com/gitteri/nonce-replacement" class="underline underline-offset-2">
			View source on GitHub
		</a>
	</p>
</main>
