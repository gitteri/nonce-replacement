<script lang="ts">
	import { getTransferSolInstruction } from '@solana-program/system';
	import { address, createNoopSigner, type Instruction } from '@solana/kit';
	import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
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

	// Enough to leave the fresh destination rent-exempt.
	const TIP = 1_000_000;

	let intendedLamports = $state(1_000);
	let tamperedLamports = $state(1_000_000);

	const demo = useDemoRunner();

	function onRun() {
		const intended = BigInt(Math.max(0, Math.round(intendedLamports)));
		const tampered = BigInt(Math.max(0, Math.round(tamperedLamports)));

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
			const nonce = await fetchStoredNonce(connection, nonceAccount);
			const { submit } = await presign(PROGRAM_IDS, cold, nonceAccount, nonce, [
				getTransferSolInstruction({
					source: createNoopSigner(pda),
					destination: address(destination.toBase58()),
					amount: intended
				})
			]);
			addStep({ label: `Cold key signed a ${intended} lamport transfer`, detail: `to ${destination.toBase58()}` });

			// The transfer amount is the last 8 bytes of the nested payload, so of Submit data too.
			const bumped = Uint8Array.from(submit.data!);
			new DataView(bumped.buffer).setBigUint64(bumped.length - 8, tampered, true);
			const accounts = submit.accounts!;
			const destinationIndex = accounts.findIndex((meta) => meta.address === destination.toBase58());
			const relayer = address(wallet.publicKey!.toBase58());

			const attempts: [string, Instruction][] = [
				[`amount bumped to ${tampered}`, { ...submit, data: bumped }],
				[
					'destination swapped for the relayer',
					{
						...submit,
						accounts: accounts.map((meta, i) =>
							i === destinationIndex ? { ...meta, address: relayer } : meta
						)
					}
				]
			];
			for (const [label, ix] of attempts) {
				try {
					const sig = await sendV1(connection, wallet, [toV1Instruction(ix)]);
					addStep({ label: `UNEXPECTED: ${label} landed`, detail: sig, node: 'Submit' });
				} catch (err) {
					addStep({
						label: `Tampered (${label}): rejected, as expected`,
						detail: errorMessage(err),
						node: 'Submit (rejected)'
					});
				}
			}

			const pdaBefore = await connection.getBalance(new PublicKey(pda), 'confirmed');
			const tip = SystemProgram.transfer({
				fromPubkey: wallet.publicKey!,
				toPubkey: destination,
				lamports: TIP
			});
			const sig = await sendV1(connection, wallet, [tip, toV1Instruction(submit)]);
			const pdaAfter = await connection.getBalance(new PublicKey(pda), 'confirmed');
			addStep({
				label: 'The untouched Submit lands, next to a relayer instruction of its own',
				detail:
					`The PDA paid ${pdaBefore - pdaAfter} lamports, exactly what was signed. The ` +
					`${TIP} lamport tip came from the wallet, which can add instructions but can't ` +
					"spend the PDA's lamports.",
				link: explorerLink(sig),
				node: 'Submit'
			});
		});
	}
</script>

<DeploymentGate>
	<DemoCard
		connected={!!wallet.publicKey}
		description="Pre-signs a transfer, then tries to land it with the amount bumped and with the destination swapped. The Signer rejects both because the cold key's signature covers every byte and account of the payload."
		status={demo.status}
		steps={demo.steps}
		error={demo.error}
		{onRun}
	>
		{#snippet params()}
			<NumberField label="Signed transfer" bind:value={intendedLamports} min={0} step={100} suffix="lamports" />
			<NumberField label="Tampered amount" bind:value={tamperedLamports} min={0} step={1000} suffix="lamports" />
		{/snippet}
	</DemoCard>
</DeploymentGate>
