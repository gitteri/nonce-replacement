<script lang="ts">
	import { base } from '$app/paths';
	import { programmaticSigner, vector } from '$lib/content/solutions';
	import FitBadge from '$lib/components/FitBadge.svelte';

	const solutions = [vector, programmaticSigner];

	const differences: { label: string; vector: string; programmaticSigner: string }[] = [
		{
			label: 'Signature covers',
			vector: 'Every top-level instruction',
			programmaticSigner: 'The authorization message'
		},
		{
			label: 'Payload format',
			vector: 'SHA-256 of the instruction list',
			programmaticSigner: 'Standard v1 message'
		},
		{
			label: 'Relayer may add instructions',
			vector: 'No, by design',
			programmaticSigner: 'Yes, around Submit'
		},
		{
			label: 'Signer PDA',
			vector: '["vector", identity], created by Initialize',
			programmaticSigner: '["programmatic-signer", authority], no setup'
		},
		{
			label: 'Holding SOL',
			vector: 'Vector-owned account. Send out with Withdraw or Close',
			programmaticSigner: 'System-owned account. Send out with a signed Transfer'
		},
		{
			label: 'Concurrent transactions',
			vector: 'One per identity',
			programmaticSigner: 'Many nonce accounts per authority'
		},
		{
			label: 'Multiple signers',
			vector: 'One identity per account',
			programmaticSigner: 'Yes'
		},
		{
			label: 'Your instructions run at',
			vector: 'Stack height 2',
			programmaticSigner: 'Stack height 3'
		},
		{
			label: 'Signature schemes',
			vector: 'Ed25519, secp256k1, EIP-191, Falcon-512',
			programmaticSigner: 'Ed25519, more via new signer programs'
		},
		{
			label: 'Programs',
			vector: '1 per scheme',
			programmaticSigner: '3 (signer, executor, nonce)'
		},
		{
			label: 'Status',
			vector: 'Program IDs published, audit status not stated',
			programmaticSigner: 'Devnet, audits pending'
		}
	];
</script>

<main class="mx-auto flex min-h-screen max-w-4xl flex-col justify-center px-6 py-24">
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
		<a
			href="{base}/programmatic-signer"
			class="rounded-lg border border-neutral-200 p-5 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
		>
			<div class="font-medium">Ed25519 Programmatic Signer</div>
			<p class="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
				Anza&apos;s three-program offline signer. Live now.
			</p>
		</a>
	</div>

	<h2 class="mt-16 text-2xl font-semibold tracking-tight">Comparing the two</h2>
	<p class="mt-3 text-neutral-600 dark:text-neutral-400">
		Both follow the same pattern: the cold key signs offline, a hot fee payer lands it in a normal
		transaction, and the program checks the signature, advances its own nonce, and runs the
		instructions by CPI with a PDA as signer. The Programmatic Signer stays closer to today&apos;s
		durable nonce flow, with a v1 message payload, multiple signers and room for the relayer to add
		instructions. Vector binds the whole transaction to the signature, supports non-Solana and
		post-quantum keys, and runs instructions one CPI level higher.
	</p>

	<h3 class="mt-10 text-lg font-medium">Fit against the 9 requirements</h3>
	<div class="mt-4 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
		<table class="w-full text-left text-sm">
			<thead class="bg-neutral-50 text-neutral-500 dark:bg-neutral-900">
				<tr>
					<th class="px-4 py-3 font-medium">Requirement</th>
					{#each solutions as s (s.slug)}
						<th class="px-4 py-3 font-medium">{s.name}</th>
					{/each}
				</tr>
			</thead>
			<tbody class="divide-y divide-neutral-200 dark:divide-neutral-800">
				{#each vector.requirements as r, i (r.slug)}
					<tr>
						<td class="px-4 py-3">
							<span class="tabular-nums text-neutral-500">{r.number}.</span>
							{r.title}
						</td>
						{#each solutions as s (s.slug)}
							{@const req = s.requirements[i]}
							<td class="px-4 py-3">
								<a href="{base}/{s.slug}/{req.slug}" title={req.fitNote} class="hover:opacity-75">
									<FitBadge fit={req.fit} />
								</a>
							</td>
						{/each}
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<h3 class="mt-10 text-lg font-medium">How they differ</h3>
	<div class="mt-4 overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-800">
		<table class="w-full text-left text-sm">
			<thead class="bg-neutral-50 text-neutral-500 dark:bg-neutral-900">
				<tr>
					<th class="px-4 py-3 font-medium"></th>
					<th class="px-4 py-3 font-medium">Vector</th>
					<th class="px-4 py-3 font-medium">Programmatic Signer</th>
				</tr>
			</thead>
			<tbody class="divide-y divide-neutral-200 dark:divide-neutral-800">
				{#each differences as d (d.label)}
					<tr>
						<td class="px-4 py-3 font-medium">{d.label}</td>
						<td class="px-4 py-3 text-neutral-600 dark:text-neutral-400">{d.vector}</td>
						<td class="px-4 py-3 text-neutral-600 dark:text-neutral-400">{d.programmaticSigner}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<p class="mt-10 text-sm text-neutral-500">
		<a href="https://github.com/gitteri/nonce-replacement" class="underline underline-offset-2">
			View source on GitHub
		</a>
	</p>
</main>
