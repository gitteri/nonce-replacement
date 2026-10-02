<script lang="ts">
	import { fly } from 'svelte/transition';

	export interface StepBox {
		label: string;
		detail?: string;
		variant: 'neutral' | 'accent' | 'warning';
	}

	export interface Step {
		phase: 'mechanism' | 'migration';
		title: string;
		body: string;
		boxes: StepBox[];
		note?: string;
	}

	let { steps }: { steps: Step[] } = $props();

	let index = $state(0);
	let direction = $state(1);

	let current = $derived(steps[index]);
	let phaseLabel = $derived(current.phase === 'mechanism' ? 'How it works' : 'Migration path');

	function goTo(target: number) {
		if (target === index) return;
		direction = target > index ? 1 : -1;
		index = target;
	}

	function next() {
		if (index < steps.length - 1) goTo(index + 1);
	}

	function prev() {
		if (index > 0) goTo(index - 1);
	}

	function variantClass(variant: StepBox['variant']): string {
		if (variant === 'accent') return 'border-transparent text-white';
		if (variant === 'warning') return 'border-amber-400 text-amber-700 dark:border-amber-500 dark:text-amber-400';
		return 'border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-300';
	}
</script>

<section class="mt-10">
	<h2 class="text-sm font-medium uppercase tracking-wide text-neutral-500">How it works</h2>

	<!-- Progress dots: click any step to jump straight to it -->
	<div class="mt-4 flex items-center gap-1.5 overflow-x-auto pb-1">
		{#each steps as step, i}
			<button
				type="button"
				onclick={() => goTo(i)}
				aria-label={`Go to step ${i + 1}`}
				aria-current={i === index}
				class="flex h-2.5 rounded-full transition-all {i === index ? 'w-6' : 'w-2.5'} {i <= index
					? ''
					: 'bg-neutral-200 dark:bg-neutral-800'}"
				style={i <= index ? `background: var(--accent); opacity: ${i === index ? 1 : 0.4}` : ''}
			></button>
		{/each}
	</div>

	{#key index}
		<div
			in:fly={{ x: direction * 24, duration: 300 }}
			class="mt-4 rounded-lg border border-neutral-200 p-6 dark:border-neutral-800"
		>
			<div class="flex items-center gap-3">
				<span
					class="rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase {current.phase ===
					'mechanism'
						? 'text-white'
						: 'bg-neutral-100 text-neutral-500 dark:bg-neutral-900'}"
					style={current.phase === 'mechanism' ? 'background: var(--accent)' : ''}
				>
					{phaseLabel}
				</span>
				<span class="text-xs tabular-nums text-neutral-400">Step {index + 1} of {steps.length}</span>
			</div>

			<h3 class="mt-3 text-lg font-semibold tracking-tight">{current.title}</h3>

			<div class="mt-4 flex flex-wrap items-center gap-1.5">
				{#each current.boxes as box, i}
					{#if i > 0}
						<span class="text-neutral-400 dark:text-neutral-600" aria-hidden="true">&rarr;</span>
					{/if}
					<span
						class="rounded-md border px-3 py-1.5 text-xs font-medium {variantClass(box.variant)}"
						style={box.variant === 'accent' ? 'background: var(--accent)' : ''}
					>
						{box.label}
						{#if box.detail}
							<span class="block text-[10px] font-normal opacity-80">{box.detail}</span>
						{/if}
					</span>
				{/each}
			</div>

			<p class="mt-4 text-sm text-neutral-700 dark:text-neutral-300">{current.body}</p>

			{#if current.note}
				<p class="mt-2 text-xs text-neutral-500">{current.note}</p>
			{/if}
		</div>
	{/key}

	<div class="mt-4 flex items-center justify-between">
		<button
			type="button"
			onclick={prev}
			disabled={index === 0}
			class="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium disabled:opacity-40 dark:border-neutral-700"
		>
			&larr; Previous
		</button>
		<button
			type="button"
			onclick={next}
			disabled={index === steps.length - 1}
			class="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
		>
			Next &rarr;
		</button>
	</div>
</section>
