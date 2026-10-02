<script lang="ts">
	import { base } from '$app/paths';
	import type { Requirement } from '$lib/content/requirements';
	import type { Solution } from '$lib/content/solutions';
	import FitBadge from './FitBadge.svelte';

	let { solution, requirement }: { solution: Solution; requirement: Requirement } = $props();
</script>

<a
	href="{base}/{solution.slug}/{requirement.slug}"
	class="block rounded-lg border border-neutral-200 p-4 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
>
	<div class="flex items-start justify-between gap-3">
		<div>
			<div class="text-xs tabular-nums text-neutral-500">Requirement {requirement.number}</div>
			<div class="mt-1 font-medium">{requirement.title}</div>
		</div>
		<FitBadge fit={requirement.fit} />
	</div>
	<p class="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{requirement.fitNote}</p>
</a>
