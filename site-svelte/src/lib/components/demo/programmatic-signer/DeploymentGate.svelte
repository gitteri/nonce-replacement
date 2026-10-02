<script lang="ts">
	import type { Snippet } from 'svelte';
	import { connection } from '$lib/vector';
	import { missingPrograms, PROGRAM_IDS } from '$lib/programmatic-signer';

	let { children }: { children: Snippet } = $props();

	let missing = $state<string[] | null>(null);
	let error = $state<string | null>(null);

	$effect(() => {
		missingPrograms(connection, PROGRAM_IDS)
			.then((ids) => (missing = ids))
			.catch((err) => (error = err instanceof Error ? err.message : String(err)));
	});
</script>

{#if error}
	<div class="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
		Couldn't check the devnet deployment: {error}
	</div>
{:else if missing === null}
	<div class="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
		Checking the devnet deployment&hellip;
	</div>
{:else if missing.length > 0}
	<div class="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
		Waiting on the devnet deploy. This demo runs against this repo's build of the programs, and
		these ids aren't live on devnet yet:
		<ul class="mt-2 space-y-1">
			{#each missing as id (id)}
				<li><code class="break-all rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">{id}</code></li>
			{/each}
		</ul>
	</div>
{:else}
	{@render children()}
{/if}
