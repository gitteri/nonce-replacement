<script lang="ts">
	import { base } from '$app/paths';
	import { requirements } from '$lib/content/requirements';
	import RequirementCard from '$lib/components/RequirementCard.svelte';
	import StepThrough, { type Step } from '$lib/components/StepThrough.svelte';

	const steps: Step[] = [
		{
			phase: 'mechanism',
			title: 'A durable nonce is a placeholder, nothing more',
			body: "It sits between the signing authority and whatever it authorizes: a predictable value anyone watching the chain can already see.",
			boxes: [
				{ label: 'Signing authority', variant: 'neutral' },
				{ label: 'Durable nonce account', detail: 'predictable, shared counter', variant: 'neutral' },
				{ label: 'Funds & authorities', variant: 'neutral' }
			]
		},
		{
			phase: 'mechanism',
			title: 'The same nonce can back two different transactions',
			body: "The nonce doesn't bind to what it's paired with beyond the signature itself. Sign two different transactions against it and both are valid. Whichever lands first wins.",
			boxes: [
				{ label: 'Durable nonce account', variant: 'neutral' },
				{ label: 'Transaction A', variant: 'warning' },
				{ label: 'Transaction B', variant: 'warning' }
			],
			note: 'The substitution risk.'
		},
		{
			phase: 'mechanism',
			title: "Vector's signature covers the instructions themselves",
			body: 'The nonce becomes a hash of the exact instructions, the prior nonce, and the signer\'s identity, computed and signed offline. Landing the result installs it as the next nonce.',
			boxes: [
				{ label: 'Nonce + instructions + identity', variant: 'neutral' },
				{ label: 'Hashed digest', variant: 'accent' },
				{ label: 'Signed offline', variant: 'accent' }
			]
		},
		{
			phase: 'mechanism',
			title: 'Each identity gets its own lane',
			body: 'Every identity holds a separate VectorAccount. Revoking one lane leaves every other lane untouched.',
			boxes: [
				{ label: 'Identity A', detail: 'VectorAccount A', variant: 'accent' },
				{ label: 'Identity B', detail: 'VectorAccount B', variant: 'accent' }
			]
		},
		{
			phase: 'migration',
			title: 'Create the Vector PDA',
			body: 'Initialize a VectorAccount for the signing identity.',
			boxes: [
				{ label: 'Signing identity', variant: 'neutral' },
				{ label: 'Initialize', variant: 'accent' },
				{ label: 'VectorAccount (PDA)', variant: 'accent' }
			],
			note: 'Skip this if the identity already has one from an earlier rollout.'
		},
		{
			phase: 'migration',
			title: 'Move funds and authorities onto the new PDA',
			body: 'Transfer the token accounts, SOL balance, and authority roles (mint, freeze, withdraw) that need protection. It authorizes everything from here.',
			boxes: [
				{ label: 'Token accounts, balances, authority', variant: 'neutral' },
				{ label: 'Reassign', variant: 'warning' },
				{ label: 'Vector PDA', variant: 'accent' }
			]
		},
		{
			phase: 'migration',
			title: 'Switch the signing mechanism',
			body: "Point the signing and broadcast pipeline at Vector's digest construction, Advance plus Passthrough for any CPI, instead of durable-nonce transactions.",
			boxes: [
				{ label: 'Signing pipeline', variant: 'neutral' },
				{ label: 'Durable nonce (old)', variant: 'neutral' },
				{ label: 'Vector digest (new)', variant: 'accent' }
			]
		},
		{
			phase: 'migration',
			title: 'Validate in parallel, then decommission',
			body: 'Run both paths side by side. Once the new pipeline is confirmed, retire the durable nonce account and revoke its authority.',
			boxes: [
				{ label: 'Durable nonce path', variant: 'neutral' },
				{ label: 'Vector path', variant: 'accent' },
				{ label: 'Decommission old', variant: 'warning' }
			]
		}
	];
</script>

<main class="mx-auto max-w-4xl px-6 py-16">
	<a href="{base}/" class="text-sm text-neutral-500 hover:underline">&larr; Back</a>
	<h1 class="mt-4 text-3xl font-semibold tracking-tight">Vector</h1>
	<p class="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-400">
		Vector replaces a durable nonce&apos;s monotonic counter with a hashchain: each signed
		transaction&apos;s digest becomes the account&apos;s next valid nonce. A transaction is built
		offline, its signature region is swapped for the stored nonce and identity, the whole
		instruction buffer is hashed, and that digest, not the transaction itself, is what gets
		signed. Nothing can be substituted after the fact without breaking the chain.
	</p>
	<p class="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
		One <code class="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">VectorAccount</code>
		per identity holds the current nonce; landing an
		<code class="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">Advance</code>
		verifies the offchain signature and installs the next nonce, optionally passing control to a
		sibling
		<code class="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">Passthrough</code>
		instruction that CPIs into arbitrary programs with the PDA promoted to signer.
	</p>

	<StepThrough {steps} />

	<h2 class="mt-10 text-lg font-medium">Requirements</h2>
	<div class="mt-4 grid gap-3 sm:grid-cols-2">
		{#each requirements as r (r.slug)}
			<RequirementCard requirement={r} />
		{/each}
	</div>
</main>
