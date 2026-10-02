<script lang="ts">
	import { getTransferSolInstruction } from '@solana-program/system';
	import { address, createNoopSigner } from '@solana/kit';
	import { Keypair, PublicKey } from '@solana/web3.js';
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

	let doomedLamports = $state(5_000_000);

	const demo = useDemoRunner();

	function onRun() {
		const doomed = BigInt(Math.max(0, Math.round(doomedLamports)));

		demo.run(async (addStep) => {
			const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(
				connection,
				wallet,
				PROGRAM_IDS,
				{ pdaLamports: 2_000_000 }
			);
			const [nonceAccount] = nonceAccounts;
			addStep({
				label: 'Created a nonce account and funded the PDA with 2,000,000 lamports',
				detail: `PDA ${pda}`,
				link: explorerLink(setupSignature),
				node: 'Setup'
			});

			const destination = Keypair.generate().publicKey;
			const transfer = (amount: bigint) =>
				getTransferSolInstruction({
					source: createNoopSigner(pda),
					destination: address(destination.toBase58()),
					amount
				});
			const balance = () => connection.getBalance(destination, 'confirmed');
			const pdaBalance = () => connection.getBalance(new PublicKey(pda), 'confirmed');

			const nonce = await fetchStoredNonce(connection, nonceAccount);
			const failing = await presign(PROGRAM_IDS, cold, nonceAccount, nonce, [
				transfer(1_000_000n),
				transfer(doomed)
			]);
			addStep({ label: `Signed a payload: transfer 1,000,000 lamports, then ${doomed}` });

			try {
				const sig = await sendV1(connection, wallet, [toV1Instruction(failing.submit)]);
				addStep({ label: 'UNEXPECTED: this should not have landed', detail: sig, node: 'Submit' });
			} catch (err) {
				addStep({
					label: 'Transaction failed as a whole, as expected',
					detail: errorMessage(err),
					node: 'Submit (rejected)'
				});
			}

			const nonceUnchanged = (await fetchStoredNonce(connection, nonceAccount)) === nonce;
			addStep({
				label: 'Verified: no partial execution',
				detail:
					`destination holds ${await balance()} lamports, PDA still ${await pdaBalance()}. ` +
					`Nonce ${nonceUnchanged ? 'unchanged' : 'CHANGED, unexpected'}.`
			});

			const valid = await presign(PROGRAM_IDS, cold, nonceAccount, nonce, [transfer(1_000_000n)]);
			const sig = await sendV1(connection, wallet, [toV1Instruction(valid.submit)]);
			addStep({
				label: 'Re-signed a valid payload at the same nonce, and it landed',
				detail: `destination now holds ${await balance()} lamports`,
				link: explorerLink(sig),
				node: 'Submit'
			});
		});
	}
</script>

<DeploymentGate>
	<DemoCard
		connected={!!wallet.publicKey}
		description="Submits a payload whose second transfer overdraws the PDA. The whole transaction reverts, including the first transfer and the nonce advance, so the same nonce can be signed again."
		status={demo.status}
		steps={demo.steps}
		error={demo.error}
		{onRun}
	>
		{#snippet params()}
			<NumberField label="Second transfer" bind:value={doomedLamports} min={1_000_000} step={1_000_000} suffix="lamports" />
		{/snippet}
	</DemoCard>
</DeploymentGate>
