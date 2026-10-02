<script lang="ts">
	import { getTransferSolInstruction } from '@solana-program/system';
	import { address, createNoopSigner, type Address } from '@solana/kit';
	import { PublicKey } from '@solana/web3.js';
	import { wallet } from '$lib/wallet.svelte';
	import { connection, explorerLink, sendV1 } from '$lib/vector';
	import {
		fetchStoredNonce,
		nextNonce,
		presign,
		PROGRAM_IDS,
		setupSigner,
		toV1Instruction,
		type Presigned
	} from '$lib/programmatic-signer';
	import { useDemoRunner } from '$lib/demo/useDemoRunner.svelte';
	import DemoCard from '../DemoCard.svelte';
	import NumberField from '../NumberField.svelte';
	import DeploymentGate from './DeploymentGate.svelte';

	let chainLength = $state(3);

	const demo = useDemoRunner();

	function onRun() {
		const count = Math.min(5, Math.max(1, Math.round(chainLength)));

		demo.run(async (addStep) => {
			const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(
				connection,
				wallet,
				PROGRAM_IDS,
				{ pdaLamports: 2_000_000 }
			);
			const [nonceAccount] = nonceAccounts;
			addStep({
				label: 'Created a nonce account and funded the PDA',
				detail: `PDA ${pda}`,
				link: explorerLink(setupSignature),
				node: 'Setup'
			});

			const watched: Address[] = [cold.address, pda, nonceAccount];
			const snapshot = () =>
				Promise.all(
					watched.map(async (account) => {
						const key = new PublicKey(account);
						const [signatures, info] = await Promise.all([
							connection.getSignaturesForAddress(key, { limit: 1 }, 'confirmed'),
							connection.getAccountInfo(key, 'confirmed')
						]);
						return JSON.stringify([
							signatures[0]?.signature ?? null,
							info?.lamports ?? null,
							info ? Array.from(info.data) : null
						]);
					})
				);

			const before = await snapshot();
			let nonce = await fetchStoredNonce(connection, nonceAccount);
			addStep({ label: 'Read the stored nonce once, ahead of time', detail: nonce });

			const originalFetch = globalThis.fetch;
			let fetchCalls = 0;
			globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
				fetchCalls++;
				return originalFetch(...args);
			}) as typeof fetch;

			const chain: Presigned[] = [];
			try {
				for (let i = 0; i < count; i++) {
					const presigned = await presign(PROGRAM_IDS, cold, nonceAccount, nonce, [
						getTransferSolInstruction({
							source: createNoopSigner(pda),
							destination: address(wallet.publicKey!.toBase58()),
							amount: BigInt(1_000 + i)
						})
					]);
					chain.push(presigned);
					nonce = nextNonce(PROGRAM_IDS, nonceAccount, nonce, presigned.executionMessage);
				}
			} finally {
				globalThis.fetch = originalFetch;
			}
			if (fetchCalls !== 0) {
				throw new Error(`expected zero network calls while signing, saw ${fetchCalls}`);
			}
			addStep({
				label: `Signed ${count} chained transfers offline`,
				detail:
					`fetch() calls while signing: ${fetchCalls}. Each successor nonce was computed ` +
					'locally from the one before it and the signed payload.'
			});

			const after = await snapshot();
			const changed = watched.filter((_, i) => before[i] !== after[i]);
			if (changed.length > 0) throw new Error(`accounts changed while signing: ${changed.join(', ')}`);
			addStep({
				label: 'Cold key, PDA and nonce account are unchanged on chain',
				detail: 'Same latest signature, lamports and data as before signing.'
			});

			for (const [i, presigned] of chain.entries()) {
				const sig = await sendV1(connection, wallet, [toV1Instruction(presigned.submit)]);
				addStep({ label: `Landed #${i + 1}`, link: explorerLink(sig), node: `Submit #${i + 1}` });
			}

			const stored = await fetchStoredNonce(connection, nonceAccount);
			if (stored !== nonce) throw new Error(`stored nonce ${stored} does not match the prediction ${nonce}`);
			addStep({
				label: 'Stored nonce matches the offline prediction',
				detail: stored
			});
		});
	}
</script>

<DeploymentGate>
	<DemoCard
		connected={!!wallet.publicKey}
		description="Reads the nonce once, then signs a chain of transfers with no network calls, predicting each next nonce locally. Nothing on chain changes until the first Submit lands."
		status={demo.status}
		steps={demo.steps}
		error={demo.error}
		{onRun}
	>
		{#snippet params()}
			<NumberField label="Chain length" bind:value={chainLength} min={1} max={5} step={1} suffix="transfers" />
		{/snippet}
	</DemoCard>
</DeploymentGate>
