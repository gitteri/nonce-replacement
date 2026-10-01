<script lang="ts">
	import type { Snippet } from 'svelte';
	import { fly } from 'svelte/transition';
	import type { DemoStatus, Step } from '$lib/demo/useDemoRunner.svelte';

	let {
		connected,
		description,
		params,
		status,
		steps,
		error,
		onRun
	}: {
		connected: boolean;
		description: string;
		params?: Snippet;
		status: DemoStatus;
		steps: Step[];
		error: string | null;
		onRun: () => void;
	} = $props();

	let nodeSteps = $derived(steps.filter((s) => s.node));
	let lastStepIsNode = $derived(steps.length > 0 && !!steps[steps.length - 1].node);
	// Still the most recent thing that happened, and more async work is in flight right
	// after it (building/broadcasting the next instruction).
	let activeIndex = $derived(status === 'running' && lastStepIsNode ? nodeSteps.length - 1 : -1);
	// Something already happened after the last landed instruction (a read or narrative
	// step), so the box itself has settled, but work toward the next instruction continues.
	let showGhostNode = $derived(status === 'running' && nodeSteps.length > 0 && !lastStepIsNode);
</script>

{#if !connected}
	<div
		class="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700"
	>
		Connect a wallet (top left) to run this demo live on devnet.
	</div>
{:else}
	<div class="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
		<div class="text-sm text-neutral-600 dark:text-neutral-400">
			{description}
		</div>
		<p class="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
			Runs entirely against devnet using the connected wallet as fee payer. Needs a small
			amount of devnet SOL, available from
			<a href="https://faucet.solana.com" target="_blank" rel="noreferrer" class="underline">
				faucet.solana.com
			</a>
			if the run fails on insufficient balance.
		</p>

		{#if params}
			<div class="mt-4 flex flex-wrap gap-4 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900">
				{@render params()}
			</div>
		{/if}

		<button
			type="button"
			onclick={onRun}
			disabled={status === 'running'}
			class="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
		>
			{status === 'running' ? 'Running…' : 'Run demo'}
		</button>

		{#if nodeSteps.length > 0}
			<div class="mt-4 flex items-center gap-0 overflow-x-auto pb-2">
				{#each nodeSteps as node, i (i)}
					{#if i > 0}
						<span class="h-px w-4 shrink-0 origin-left bg-neutral-300 [animation:grow-x_0.4s_ease-out] dark:bg-neutral-700"></span>
					{/if}
					<span
						in:fly={{ y: 10, duration: 300 }}
						class="relative shrink-0 rounded-md border px-3 py-1.5 text-xs font-medium {i ===
						activeIndex
							? 'flow-node-active border-transparent text-white'
							: status === 'error' && i === nodeSteps.length - 1
								? 'border-red-400 text-red-600 dark:border-red-500 dark:text-red-400'
								: 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300'}"
						class:flow-node-done={status === 'done'}
						style={status === 'done' ? `animation-delay: ${i * 60}ms` : ''}
					>
						<span
							class="absolute -top-2 -left-1 text-[9px] font-semibold tabular-nums text-neutral-400 dark:text-neutral-600"
						>
							{String(i + 1).padStart(2, '0')}
						</span>
						{node.node}
					</span>
				{/each}
				{#if showGhostNode}
					<span class="h-px w-4 shrink-0 bg-neutral-300 dark:bg-neutral-700"></span>
					<span
						in:fly={{ y: 10, duration: 300 }}
						class="shrink-0 animate-pulse rounded-md border border-dashed border-neutral-300 px-3 py-1.5 text-xs font-medium text-neutral-400 dark:border-neutral-700 dark:text-neutral-500"
					>
						&hellip;
					</span>
				{/if}
			</div>
		{/if}

		{#if steps.length > 0}
			<ol class="mt-4 space-y-3">
				{#each steps as step, i (i)}
					<li class="text-sm">
						<div class="font-medium text-neutral-800 dark:text-neutral-200">
							{step.label}
						</div>
						{#if step.detail}
							<div class="mt-0.5 break-all text-neutral-600 dark:text-neutral-400">
								{step.detail}
							</div>
						{/if}
						{#if step.link}
							<a
								href={step.link}
								target="_blank"
								rel="noreferrer"
								class="mt-0.5 inline-block text-neutral-500 underline dark:text-neutral-500"
							>
								View on explorer
							</a>
						{/if}
					</li>
				{/each}
			</ol>
		{/if}

		{#if error}
			<div
				class="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300"
			>
				{error}
			</div>
		{/if}
	</div>
{/if}

<style>
	/* Active node: solid accent fill with a moving highlight sweeping across it, signaling
	   "this instruction just landed and more work toward the next one is in flight." */
	.flow-node-active {
		background-color: var(--accent);
		background-image: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4) 50%, transparent);
		background-size: 200% 100%;
		animation: sweep 1.5s linear infinite;
	}

	/* Settle bounce across every node once a run finishes, staggered via animation-delay
	   set inline per node. */
	.flow-node-done {
		animation: pop-in 0.4s ease-out backwards;
	}
</style>
