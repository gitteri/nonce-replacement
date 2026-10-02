<script lang="ts">
	import SolutionLayout from '$lib/components/SolutionLayout.svelte';
	import { vector } from '$lib/content/solutions';

	let { children } = $props();
</script>

<SolutionLayout solution={vector}>
	{@render children()}
</SolutionLayout>
