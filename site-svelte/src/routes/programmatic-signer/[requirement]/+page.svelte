<script lang="ts">
	import type { Component } from 'svelte';
	import RequirementPage from '$lib/components/RequirementPage.svelte';
	import TimeWindowDemo from '$lib/components/demo/programmatic-signer/TimeWindowDemo.svelte';
	import ConcurrencyDemo from '$lib/components/demo/programmatic-signer/ConcurrencyDemo.svelte';
	import FeePayerSeparationDemo from '$lib/components/demo/programmatic-signer/FeePayerSeparationDemo.svelte';
	import SelectiveRevocationDemo from '$lib/components/demo/programmatic-signer/SelectiveRevocationDemo.svelte';
	import StateChangeToleranceDemo from '$lib/components/demo/programmatic-signer/StateChangeToleranceDemo.svelte';
	import TransactionIntegrityDemo from '$lib/components/demo/programmatic-signer/TransactionIntegrityDemo.svelte';
	import NoOnchainFootprintDemo from '$lib/components/demo/programmatic-signer/NoOnchainFootprintDemo.svelte';
	import ParsabilityDemo from '$lib/components/demo/programmatic-signer/ParsabilityDemo.svelte';
	import ComposabilityDemo from '$lib/components/demo/programmatic-signer/ComposabilityDemo.svelte';
	import { programmaticSigner } from '$lib/content/solutions';
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

<RequirementPage solution={programmaticSigner} requirement={data.requirement} demos={DEMOS} />
