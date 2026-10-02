<script lang="ts">
	import { getTransferSolInstruction } from '@solana-program/system';
	import { address, createNoopSigner } from '@solana/kit';
	import { wallet } from '$lib/wallet.svelte';
	import { connection, explorerAccountLink, explorerLink, sendV1 } from '$lib/vector';
	import {
		fetchStoredNonce,
		presign,
		PROGRAM_IDS,
		setupSigner,
		toV1Instruction
	} from '$lib/programmatic-signer';
	import { useDemoRunner } from '$lib/demo/useDemoRunner.svelte';
	import DemoCard from '../DemoCard.svelte';
	import NumberField from '../NumberField.svelte';
	import DeploymentGate from './DeploymentGate.svelte';

	let waitSeconds = $state(0);

	const demo = useDemoRunner();

	function onRun() {
		const wait = Math.max(0, Math.round(waitSeconds));

		demo.run(async (addStep) => {
			const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(
				connection,
				wallet,
				PROGRAM_IDS,
				{ pdaLamports: 2_000_000 }
			);
			const [nonceAccount] = nonceAccounts;
			addStep({
				label: 'Created a nonce account under a fresh cold key',
				detail: `Programmatic signer PDA ${pda}, nonce account ${nonceAccount}`,
				link: explorerLink(setupSignature),
				node: 'Setup'
			});

			const nonce = await fetchStoredNonce(connection, nonceAccount);
			addStep({ label: 'Fetched the stored nonce', detail: nonce });

			const presigned = await presign(PROGRAM_IDS, cold, nonceAccount, nonce, [
				getTransferSolInstruction({
					source: createNoopSigner(pda),
					destination: address(wallet.publicKey!.toBase58()),
					amount: 1_000n
				})
			]);
			const signedAt = new Date();
			addStep({
				label: `Cold key signed a transfer at ${signedAt.toLocaleTimeString()}`,
				detail:
					'The signed message carries the nonce where a blockhash would go and no expiry. ' +
					'Neither the Signer nor the Executor reads the clock or slot, so it stays valid ' +
					'until this nonce account advances. A regular Solana transaction expires in 60-90 ' +
					'seconds once its blockhash ages out.'
			});

			if (wait > 0) {
				addStep({ label: `Waiting ${wait}s before broadcasting` });
				await new Promise((resolve) => setTimeout(resolve, wait * 1000));
			}

			const signature = await sendV1(connection, wallet, [toV1Instruction(presigned.submit)]);
			const elapsed = Math.round((Date.now() - signedAt.getTime()) / 1000);
			addStep({
				label: `Landed it ${elapsed}s after signing`,
				detail: 'Your wallet paid the fee. The cold key never signed a transaction.',
				link: explorerLink(signature),
				node: 'Submit'
			});

			addStep({
				label: 'Nonce advanced',
				detail: await fetchStoredNonce(connection, nonceAccount),
				link: explorerAccountLink(nonceAccount)
			});
		});
	}
</script>

<DeploymentGate>
	<DemoCard
		connected={!!wallet.publicKey}
		description="Creates a nonce account under a fresh cold key, signs a transfer offline, then lands it. Raise the wait past 90 seconds to outlive any blockhash."
		status={demo.status}
		steps={demo.steps}
		error={demo.error}
		{onRun}
	>
		{#snippet params()}
			<NumberField label="Wait before landing" bind:value={waitSeconds} min={0} step={30} suffix="seconds" />
		{/snippet}
	</DemoCard>
</DeploymentGate>
