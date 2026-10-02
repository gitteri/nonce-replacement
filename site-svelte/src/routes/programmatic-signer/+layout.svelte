<script lang="ts">
	import SolutionLayout from '$lib/components/SolutionLayout.svelte';
	import { programmaticSigner } from '$lib/content/solutions';

	let { children } = $props();
</script>

<SolutionLayout solution={programmaticSigner}>
	{@render children()}
</SolutionLayout>
