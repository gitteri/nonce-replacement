<script lang="ts">
	import { getTransferSolInstruction } from '@solana-program/system';
	import { address, createNoopSigner } from '@solana/kit';
	import { wallet } from '$lib/wallet.svelte';
	import { connection, explorerLink, sendV1 } from '$lib/vector';
	import {
		fetchStoredNonce,
		nextNonce,
		presign,
		PROGRAM_IDS,
		setupSigner,
		toV1Instruction
	} from '$lib/programmatic-signer';
	import { errorMessage, useDemoRunner } from '$lib/demo/useDemoRunner.svelte';
	import DemoCard from '../DemoCard.svelte';
	import NumberField from '../NumberField.svelte';
	import DeploymentGate from './DeploymentGate.svelte';

	let accountCount = $state(3);

	const demo = useDemoRunner();

	function onRun() {
		const count = Math.max(2, Math.min(3, Math.round(accountCount)));

		demo.run(async (addStep) => {
			const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(
				connection,
				wallet,
				PROGRAM_IDS,
				{ nonceAccounts: count + 1, pdaLamports: 2_000_000 }
			);
			const parallel = nonceAccounts.slice(0, count);
			const chained = nonceAccounts[count];
			addStep({
				label: `Created ${count + 1} nonce accounts under one cold key`,
				detail: `programmatic signer PDA ${pda}`,
				link: explorerLink(setupSignature),
				node: 'Setup'
			});

			const transfer = (amount: bigint) =>
				getTransferSolInstruction({
					source: createNoopSigner(pda),
					destination: address(wallet.publicKey!.toBase58()),
					amount
				});

			const presigned = [];
			for (const [i, account] of parallel.entries()) {
				const nonce = await fetchStoredNonce(connection, account);
				presigned.push(await presign(PROGRAM_IDS, cold, account, nonce, [transfer(BigInt(1_000 + i))]));
				addStep({ label: `Account ${i}: pre-signed one transfer`, detail: `against nonce ${nonce}` });
			}

			const signatures = await Promise.all(
				presigned.map((p) => sendV1(connection, wallet, [toV1Instruction(p.submit)]))
			);
			signatures.forEach((sig, i) => {
				addStep({ label: `Account ${i}: landed`, link: explorerLink(sig), node: `Submit ${i}` });
			});
			addStep({
				label: `All ${count} landed together`,
				detail: 'Nonce accounts under one cold key share no state, so their transactions can land in any order.'
			});

			const n0 = await fetchStoredNonce(connection, chained);
			const first = await presign(PROGRAM_IDS, cold, chained, n0, [transfer(2_000n)]);
			const n1 = nextNonce(PROGRAM_IDS, chained, n0, first.executionMessage);
			const second = await presign(PROGRAM_IDS, cold, chained, n1, [transfer(2_001n)]);
			addStep({
				label: 'Pre-signed an ordered pair on one more account',
				detail: `first at ${n0}, second at ${n1}, the nonce the first leaves behind, computed offline`
			});

			try {
				const sig = await sendV1(connection, wallet, [toV1Instruction(second.submit)]);
				addStep({ label: 'UNEXPECTED: the second landed first', detail: sig, node: 'Second' });
			} catch (err) {
				addStep({
					label: 'Second rejected before the first lands, as expected',
					detail: errorMessage(err),
					node: 'Second (rejected)'
				});
			}

			const firstSig = await sendV1(connection, wallet, [toV1Instruction(first.submit)]);
			addStep({ label: 'First landed', link: explorerLink(firstSig), node: 'First' });
			const secondSig = await sendV1(connection, wallet, [toV1Instruction(second.submit)]);
			addStep({ label: 'Second landed after it', link: explorerLink(secondSig), node: 'Second' });
		});
	}
</script>

<DeploymentGate>
	<DemoCard
		connected={!!wallet.publicKey}
		description="One cold key pre-signs a transfer on each of several nonce accounts and they all land at once. Then it chains two transactions on one account, which only land in order."
		status={demo.status}
		steps={demo.steps}
		error={demo.error}
		{onRun}
	>
		{#snippet params()}
			<NumberField label="Nonce accounts" bind:value={accountCount} min={2} max={3} />
		{/snippet}
	</DemoCard>
</DeploymentGate>
