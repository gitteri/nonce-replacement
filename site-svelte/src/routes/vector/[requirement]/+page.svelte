<script lang="ts">
	import type { Component } from 'svelte';
	import { fly } from 'svelte/transition';
	import { base } from '$app/paths';
	import FitBadge from '$lib/components/FitBadge.svelte';
	import CodeBlock from '$lib/components/CodeBlock.svelte';
	import TimeWindowDemo from '$lib/components/demo/TimeWindowDemo.svelte';
	import ConcurrencyDemo from '$lib/components/demo/ConcurrencyDemo.svelte';
	import FeePayerSeparationDemo from '$lib/components/demo/FeePayerSeparationDemo.svelte';
	import TransactionIntegrityDemo from '$lib/components/demo/TransactionIntegrityDemo.svelte';
	import SelectiveRevocationDemo from '$lib/components/demo/SelectiveRevocationDemo.svelte';
	import NoOnchainFootprintDemo from '$lib/components/demo/NoOnchainFootprintDemo.svelte';
	import ParsabilityDemo from '$lib/components/demo/ParsabilityDemo.svelte';
	import StateChangeToleranceDemo from '$lib/components/demo/StateChangeToleranceDemo.svelte';
	import ComposabilityDemo from '$lib/components/demo/ComposabilityDemo.svelte';
	import { requirements } from '$lib/content/requirements';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let requirement = $derived(data.requirement);

	const DEMOS: Record<string, Component> = {
		'time-window': TimeWindowDemo,
		concurrency: ConcurrencyDemo,
		'fee-payer-separation': FeePayerSeparationDemo,
		'transaction-integrity': TransactionIntegrityDemo,
		'selective-revocation': SelectiveRevocationDemo,
		'no-onchain-footprint': NoOnchainFootprintDemo,
		parsability: ParsabilityDemo,
		'state-change-tolerance': StateChangeToleranceDemo,
		composability: ComposabilityDemo
	};
	let Demo = $derived(DEMOS[requirement.slug]);
</script>

<main class="max-w-3xl pb-24">
{#key requirement.slug}
	<a href="{base}/vector" class="text-sm text-neutral-500 hover:underline">&larr; Vector</a>
	<header class="relative mt-4">
		<div class="flex items-center gap-3">
			<span class="text-xs font-semibold uppercase tracking-widest text-neutral-500">
				Requirement {requirement.number} of {requirements.length}
			</span>
			<FitBadge fit={requirement.fit} />
		</div>
		<div class="relative mt-1 flex items-baseline gap-3 sm:gap-4">
			<span
				aria-hidden="true"
				class="pointer-events-none -mb-2 shrink-0 text-6xl font-bold leading-none opacity-15 sm:text-8xl"
				style="color: var(--accent)"
			>
				{String(requirement.number).padStart(2, '0')}
			</span>
			<h1 class="text-3xl font-bold tracking-tight sm:text-4xl">{requirement.title}</h1>
		</div>
	</header>

	<div class="mt-6 grid gap-4 sm:grid-cols-3">
		<div
			in:fly={{ y: 12, duration: 400, delay: 0 }}
			class="rounded-lg border border-neutral-200 p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800"
		>
			<div class="text-xs font-medium uppercase tracking-wide text-neutral-500">What</div>
			<p class="mt-2 text-sm text-neutral-800 dark:text-neutral-200">{requirement.spec}</p>
		</div>
		<div
			in:fly={{ y: 12, duration: 400, delay: 80 }}
			class="rounded-lg border border-neutral-200 p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800"
		>
			<div class="text-xs font-medium uppercase tracking-wide text-neutral-500">Why</div>
			<p class="mt-2 text-sm text-neutral-800 dark:text-neutral-200">{requirement.useCase}</p>
		</div>
		<div
			in:fly={{ y: 12, duration: 400, delay: 160 }}
			class="rounded-lg border border-neutral-200 p-4 transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800"
		>
			<div class="text-xs font-medium uppercase tracking-wide text-neutral-500">How</div>
			<p class="mt-2 text-sm text-neutral-800 dark:text-neutral-200">{requirement.mechanism}</p>
			<p class="mt-2 text-xs text-neutral-500">{requirement.fitNote}</p>
		</div>
	</div>

	<section class="mt-8">
		<h2 class="text-sm font-medium uppercase tracking-wide text-neutral-500">Live demo</h2>
		{#if Demo}
			<div class="mt-2">
				<Demo />
			</div>
		{:else}
			<div
				class="mt-2 rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700"
			>
				Live devnet demo coming soon. See
				<code class="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">
					solutions/vector/ts/scripts/{requirement.scriptFile}
				</code>
				for the runnable version of this demo today.
			</div>
		{/if}
	</section>

	<section class="mt-8">
		<h2 class="text-sm font-medium uppercase tracking-wide text-neutral-500">Code</h2>
		<div class="mt-2 space-y-3">
			<CodeBlock
				title="solutions/vector/ts/scripts/{requirement.scriptFile}"
				code={`pnpm --filter @nonce-replacement/vector-ts exec tsx scripts/${requirement.scriptFile}`}
			/>
			<CodeBlock
				title="solutions/vector/rust/tests/{requirement.testFile}"
				code={`cargo test --package vector-tests --test ${requirement.testFile.replace(/\.rs$/, '')}`}
			/>
		</div>
	</section>
{/key}
</main>
