<script lang="ts">
	import { base } from '$app/paths';
	import { requirements } from '$lib/content/requirements';

	let { activeSlug }: { activeSlug?: string } = $props();
</script>

<nav class="space-y-1">
	{#each requirements as r (r.slug)}
		<a
			href="{base}/vector/{r.slug}"
			class="flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors {r.slug ===
			activeSlug
				? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
				: 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900'}"
		>
			<span>
				<span class="mr-2 tabular-nums opacity-60">{r.number}.</span>
				{r.title}
			</span>
		</a>
	{/each}
</nav>
