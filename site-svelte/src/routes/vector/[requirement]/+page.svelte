<script lang="ts">
	import type { Component } from 'svelte';
	import RequirementPage from '$lib/components/RequirementPage.svelte';
	import TimeWindowDemo from '$lib/components/demo/TimeWindowDemo.svelte';
	import ConcurrencyDemo from '$lib/components/demo/ConcurrencyDemo.svelte';
	import FeePayerSeparationDemo from '$lib/components/demo/FeePayerSeparationDemo.svelte';
	import TransactionIntegrityDemo from '$lib/components/demo/TransactionIntegrityDemo.svelte';
	import SelectiveRevocationDemo from '$lib/components/demo/SelectiveRevocationDemo.svelte';
	import NoOnchainFootprintDemo from '$lib/components/demo/NoOnchainFootprintDemo.svelte';
	import ParsabilityDemo from '$lib/components/demo/ParsabilityDemo.svelte';
	import StateChangeToleranceDemo from '$lib/components/demo/StateChangeToleranceDemo.svelte';
	import ComposabilityDemo from '$lib/components/demo/ComposabilityDemo.svelte';
	import { vector } from '$lib/content/solutions';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const DEMOS: Record<string, Component> = {
		'time-window': TimeWindowDemo,
		concurrency: ConcurrencyDemo,
		'fee-payer-separation': FeePayerSeparationDemo,
		'transaction-integrity': TransactionIntegrityDemo,
		'selective-revocation': SelectiveRevocationDemo,
		'no-onchain-footprint': NoOnchainFootprintDemo,
		parsability: ParsabilityDemo,
		'state-change-tolerance': StateChangeToleranceDemo,
		composability: ComposabilityDemo
	};
</script>

<RequirementPage solution={vector} requirement={data.requirement} demos={DEMOS} />
