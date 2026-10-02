<script lang="ts">
	import type { Component } from 'svelte';
	import RequirementPage from '$lib/components/RequirementPage.svelte';
	import TimeWindowDemo from '$lib/components/demo/programmatic-signer/TimeWindowDemo.svelte';
	import ConcurrencyDemo from '$lib/components/demo/programmatic-signer/ConcurrencyDemo.svelte';
	import FeePayerSeparationDemo from '$lib/components/demo/programmatic-signer/FeePayerSeparationDemo.svelte';
	import SelectiveRevocationDemo from '$lib/components/demo/programmatic-signer/SelectiveRevocationDemo.svelte';
	import StateChangeToleranceDemo from '$lib/components/demo/programmatic-signer/StateChangeToleranceDemo.svelte';
	import { programmaticSigner } from '$lib/content/solutions';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const DEMOS: Record<string, Component> = {
		'time-window': TimeWindowDemo,
		concurrency: ConcurrencyDemo,
		'fee-payer-separation': FeePayerSeparationDemo,
		'selective-revocation': SelectiveRevocationDemo,
		'state-change-tolerance': StateChangeToleranceDemo
	};
</script>

<RequirementPage solution={programmaticSigner} requirement={data.requirement} demos={DEMOS} />
