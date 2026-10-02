<script lang="ts">
	import RequirementPage from '$lib/components/RequirementPage.svelte';
	import { programmaticSigner } from '$lib/content/solutions';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<RequirementPage solution={programmaticSigner} requirement={data.requirement} />
