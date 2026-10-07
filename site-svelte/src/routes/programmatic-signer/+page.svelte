<script lang="ts">
	import { base } from '$app/paths';
	import { durableNonceSteps } from '$lib/content/durableNonceSteps';
	import { programmaticSigner } from '$lib/content/solutions';
	import RequirementCard from '$lib/components/RequirementCard.svelte';
	import StepThrough, { type Step } from '$lib/components/StepThrough.svelte';

	const steps: Step[] = [
		...durableNonceSteps,
		{
			phase: 'mechanism',
			title: 'The cold key signs a whole message offline',
			body: "The user's instructions go into an execution message with the expected nonce where a blockhash would sit. That message becomes the data of one Execute instruction, wrapped in an authorization message, and the cold key signs the wrapper.",
			boxes: [
				{ label: 'Execution message', detail: 'instructions + nonce', variant: 'neutral' },
				{ label: 'Authorization message', detail: 'wraps Execute', variant: 'accent' },
				{ label: 'Signed offline', variant: 'accent' }
			]
		},
		{
			phase: 'mechanism',
			title: 'Any relayer can land it',
			body: "A relayer sends Submit with the signature and pays the fee. The Signer program verifies the signature and calls the Executor with the cold key's PDA as signer. The Executor checks the nonce, advances it, then runs each instruction.",
			boxes: [
				{ label: 'Relayer', detail: 'Submit', variant: 'neutral' },
				{ label: 'Signer', detail: 'verifies Ed25519', variant: 'accent' },
				{ label: 'Executor', detail: 'advances nonce, runs payload', variant: 'accent' }
			],
			note: 'The relayer never gets the PDA\'s authority for anything outside the signed message.'
		},
		{
			phase: 'mechanism',
			title: 'One cold key, many nonce accounts',
			body: 'Each nonce account holds one outstanding transaction, and every one of them acts for the same PDA. Revoking one leaves the others untouched.',
			boxes: [
				{ label: 'Cold key PDA', variant: 'accent' },
				{ label: 'Nonce account A', variant: 'accent' },
				{ label: 'Nonce account B', variant: 'accent' }
			]
		},
		{
			phase: 'migration',
			title: 'Create nonce accounts for the cold key',
			body: "Derive the cold key's PDA and initialize one nonce account per concurrent transaction, with the PDA as nonce authority.",
			boxes: [
				{ label: 'Cold key', variant: 'neutral' },
				{ label: 'Initialize', variant: 'accent' },
				{ label: 'Nonce accounts', variant: 'accent' }
			],
			note: 'The PDA holds no data and needs no initialization of its own.'
		},
		{
			phase: 'migration',
			title: 'Move funds and authorities onto the PDA',
			body: 'Transfer the token accounts, SOL balance, and authority roles (mint, freeze, withdraw) that need protection. It authorizes everything from here.',
			boxes: [
				{ label: 'Token accounts, balances, authority', variant: 'neutral' },
				{ label: 'Reassign', variant: 'warning' },
				{ label: 'Cold key PDA', variant: 'accent' }
			]
		},
		{
			phase: 'migration',
			title: 'Switch the signing mechanism',
			body: 'Sign authorization messages instead of durable-nonce transactions, and hand them to a relayer that wraps each one in Submit and pays the fee.',
			boxes: [
				{ label: 'Signing pipeline', variant: 'neutral' },
				{ label: 'Durable nonce (old)', variant: 'neutral' },
				{ label: 'Authorization message (new)', variant: 'accent' }
			]
		},
		{
			phase: 'migration',
			title: 'Validate in parallel, then decommission',
			body: 'Run both paths side by side. Once the new pipeline is confirmed, retire the durable nonce account and revoke its authority.',
			boxes: [
				{ label: 'Durable nonce path', variant: 'neutral' },
				{ label: 'Programmatic Signer path', variant: 'accent' },
				{ label: 'Decommission old', variant: 'warning' }
			]
		}
	];
</script>

<main class="mx-auto max-w-4xl px-6 py-16">
	<a href="{base}/" class="text-sm text-neutral-500 hover:underline">&larr; Back</a>
	<h1 class="mt-4 text-3xl font-semibold tracking-tight">Ed25519 Programmatic Signer</h1>
	<p class="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-400">
		Anza&apos;s Programmatic Signer moves signature checking into a program. The cold key signs a
		serialized Solana message offline, and any relayer can later land it with a
		<code class="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">Submit</code>
		instruction and pay the fee. The signed message names the nonce it expects, so it stays valid
		until that nonce advances and can&apos;t be replayed after.
	</p>
	<p class="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
		Three programs split the work. The Signer verifies the Ed25519 signature and promotes the cold
		key&apos;s PDA to signer, the Executor checks and advances the nonce then replays the signed
		instructions, and the Nonce program stores a hashchain value per nonce account. Upstream is
		pre-audit and has no mainnet deployment. The demos run against Anza&apos;s canonical devnet
		programs, and the client code is pinned to commit
		<code class="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">5a679d1</code>.
	</p>

	<StepThrough {steps} />

	<h2 class="mt-10 text-lg font-medium">Requirements</h2>
	<div class="mt-4 grid gap-3 sm:grid-cols-2">
		{#each programmaticSigner.requirements as r (r.slug)}
			<RequirementCard solution={programmaticSigner} requirement={r} />
		{/each}
	</div>
</main>
