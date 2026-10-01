<script lang="ts">
	let {
		label,
		value = $bindable(),
		suffix,
		min,
		max,
		step = 1
	}: {
		label: string;
		value: number;
		suffix?: string;
		min?: number;
		max?: number;
		step?: number;
	} = $props();
</script>

<label class="text-sm">
	<span class="block text-neutral-600 dark:text-neutral-400">{label}</span>
	<span class="mt-1 flex items-center gap-2">
		<input
			type="number"
			bind:value
			{min}
			{max}
			{step}
			class="w-36 rounded-md border border-neutral-300 px-2 py-1 text-sm tabular-nums dark:border-neutral-700 dark:bg-neutral-950"
		/>
		{#if suffix}
			<span class="text-xs text-neutral-500">{suffix}</span>
		{/if}
	</span>
</label>
