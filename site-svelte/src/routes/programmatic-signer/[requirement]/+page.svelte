<script lang="ts">
	import type { Component } from 'svelte';
	import RequirementPage from '$lib/components/RequirementPage.svelte';
	import TimeWindowDemo from '$lib/components/demo/programmatic-signer/TimeWindowDemo.svelte';
	import SelectiveRevocationDemo from '$lib/components/demo/programmatic-signer/SelectiveRevocationDemo.svelte';
	import { programmaticSigner } from '$lib/content/solutions';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const DEMOS: Record<string, Component> = {
		'time-window': TimeWindowDemo,
		'selective-revocation': SelectiveRevocationDemo
	};
</script>

<RequirementPage solution={programmaticSigner} requirement={data.requirement} demos={DEMOS} />
