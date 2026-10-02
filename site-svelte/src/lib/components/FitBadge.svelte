<script lang="ts">
	import type { Fit } from '$lib/content/requirements';

	let { fit }: { fit: Fit } = $props();

	const isFull = $derived(fit === 'full');
</script>

<span
	class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {isFull
		? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
		: 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300'}"
>
	{isFull ? 'Full fit' : 'Partial fit'}
</span>
