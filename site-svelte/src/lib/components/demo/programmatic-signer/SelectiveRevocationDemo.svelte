<script lang="ts">
	import { getTransferSolInstruction } from '@solana-program/system';
	import { address, createNoopSigner } from '@solana/kit';
	import { wallet } from '$lib/wallet.svelte';
	import { connection, explorerLink, sendV1 } from '$lib/vector';
	import {
		fetchStoredNonce,
		presign,
		PROGRAM_IDS,
		setupSigner,
		toV1Instruction
	} from '$lib/programmatic-signer';
	import { errorMessage, useDemoRunner } from '$lib/demo/useDemoRunner.svelte';
	import DemoCard from '../DemoCard.svelte';
	import NumberField from '../NumberField.svelte';
	import DeploymentGate from './DeploymentGate.svelte';

	let transferLamports = $state(1_000);

	const demo = useDemoRunner();

	function onRun() {
		const amount = BigInt(Math.max(0, Math.round(transferLamports)));

		demo.run(async (addStep) => {
			const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(
				connection,
				wallet,
				PROGRAM_IDS,
				{ nonceAccounts: 2, pdaLamports: 2_000_000 }
			);
			const [accountA, accountB] = nonceAccounts;
			addStep({
				label: 'Created nonce accounts A (to be revoked) and B (untouched) under one cold key',
				detail: `A: ${accountA}, B: ${accountB}`,
				link: explorerLink(setupSignature),
				node: 'Setup A + B'
			});

			const transfer = () =>
				getTransferSolInstruction({
					source: createNoopSigner(pda),
					destination: address(wallet.publicKey!.toBase58()),
					amount
				});
			const nonceA = await fetchStoredNonce(connection, accountA);
			const payloadA = await presign(PROGRAM_IDS, cold, accountA, nonceA, [transfer()]);
			const nonceB = await fetchStoredNonce(connection, accountB);
			const payloadB = await presign(PROGRAM_IDS, cold, accountB, nonceB, [transfer()]);
			addStep({
				label: 'Cold key pre-signed a transfer on each account',
				detail: 'holding both back, not broadcasting yet'
			});

			const revocation = await presign(PROGRAM_IDS, cold, accountA, nonceA, []);
			const revokeSig = await sendV1(connection, wallet, [toV1Instruction(revocation.submit)]);
			addStep({
				label: "Revoked A: landed an empty payload at A's outstanding nonce",
				detail: 'That advances A with a different commitment than the held transfer.',
				link: explorerLink(revokeSig),
				node: 'Revoke A'
			});

			try {
				const sig = await sendV1(connection, wallet, [toV1Instruction(payloadA.submit)]);
				addStep({ label: 'UNEXPECTED: revoked payload landed', detail: sig, node: 'Submit A' });
			} catch (err) {
				addStep({
					label: "A's pre-signed transfer rejected, as expected",
					detail: `${errorMessage(err)}. The Executor's nonce check fails because A moved on.`,
					node: 'Submit A (rejected)'
				});
			}

			const sigB = await sendV1(connection, wallet, [toV1Instruction(payloadB.submit)]);
			addStep({
				label: "B's transfer lands, unaffected by A's revocation",
				link: explorerLink(sigB),
				node: 'Submit B'
			});
		});
	}
</script>

<DeploymentGate>
	<DemoCard
		connected={!!wallet.publicKey}
		description="One cold key pre-signs a transfer on nonce accounts A and B, then revokes A with an empty payload at the same nonce. A's transfer can no longer land. B's still does."
		status={demo.status}
		steps={demo.steps}
		error={demo.error}
		{onRun}
	>
		{#snippet params()}
			<NumberField label="Transfer amount" bind:value={transferLamports} min={0} step={100} suffix="lamports" />
		{/snippet}
	</DemoCard>
</DeploymentGate>
