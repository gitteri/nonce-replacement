<script lang="ts">
	let { title, code }: { title?: string; code: string } = $props();
</script>

<div class="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
	{#if title}
		<div
			class="border-b border-neutral-200 bg-neutral-50 px-4 py-2 font-mono text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400"
		>
			{title}
		</div>
	{/if}
	<pre class="overflow-x-auto bg-neutral-950 p-4 text-sm text-neutral-100"><code>{code}</code></pre>
</div>
