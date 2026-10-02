<script lang="ts">
	import {
		getTransferSolInstruction,
		identifySystemInstruction,
		parseTransferSolInstruction,
		SYSTEM_PROGRAM_ADDRESS,
		SystemInstruction
	} from '@solana-program/system';
	import { address, createNoopSigner } from '@solana/kit';
	import { wallet } from '$lib/wallet.svelte';
	import { connection, explorerLink, sendV1 } from '$lib/vector';
	import {
		decodeSubmit,
		fetchStoredNonce,
		presign,
		PROGRAM_IDS,
		setupSigner,
		toV1Instruction
	} from '$lib/programmatic-signer';
	import DemoCard from '../DemoCard.svelte';
	import NumberField from '../NumberField.svelte';
	import { useDemoRunner } from '$lib/demo/useDemoRunner.svelte';
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
				{ pdaLamports: 2_000_000 }
			);
			const [nonceAccount] = nonceAccounts;
			addStep({
				label: 'Created a nonce account and funded the PDA with 2,000,000 lamports',
				detail: `PDA ${pda}`,
				link: explorerLink(setupSignature),
				node: 'Setup'
			});

			const nonce = await fetchStoredNonce(connection, nonceAccount);
			const { submit } = await presign(PROGRAM_IDS, cold, nonceAccount, nonce, [
				getTransferSolInstruction({
					source: createNoopSigner(pda),
					destination: address(wallet.publicKey!.toBase58()),
					amount
				})
			]);
			addStep({ label: 'Cold key signed a transfer. Everything below reads only the Submit instruction.' });

			const decoded = decodeSubmit(submit.data!);
			addStep({
				label: 'Layer 1: Submit data',
				detail: `${decoded.signers.length} signature(s) over a ${decoded.authorizationBytes} byte authorization message`
			});
			addStep({
				label: 'Layer 2: authorization message, a v1 message',
				detail:
					decoded.signers.map((s) => `${s.address}: signature ${s.valid ? 'valid' : 'INVALID'}`).join('. ') +
					`. One instruction, to ${decoded.program === PROGRAM_IDS.executor ? 'the Message Executor' : decoded.program}.`
			});
			if (decoded.signers.some((s) => !s.valid)) throw new Error('Policy failed: bad signature');
			addStep({
				label: 'Layer 3: execution message, another v1 message',
				detail: `Expected nonce in the lifetime slot: ${decoded.expectedNonce}. Acting as ${decoded.actingAs}, the cold key's programmatic signer.`
			});

			for (const ix of decoded.instructions) {
				if (
					ix.programAddress === SYSTEM_PROGRAM_ADDRESS &&
					ix.data &&
					identifySystemInstruction(ix.data) === SystemInstruction.TransferSol
				) {
					const parsed = parseTransferSolInstruction(ix as Parameters<typeof parseTransferSolInstruction>[0]);
					addStep({
						label: "Layer 4: the user's instruction, decoded with the stock System program client",
						detail: `System transfer: ${parsed.data.amount} lamports from ${parsed.accounts.source.address} to ${parsed.accounts.destination.address}`
					});
				} else {
					addStep({ label: "Layer 4: the user's instruction", detail: `to ${ix.programAddress}` });
				}
			}

			const sig = await sendV1(connection, wallet, [toV1Instruction(submit)]);
			addStep({ label: 'Policy passed, landed the Submit', link: explorerLink(sig), node: 'Submit' });
		});
	}
</script>

<DeploymentGate>
	<DemoCard
		connected={!!wallet.publicKey}
		description="Pre-signs a System transfer, then peels the Submit instruction apart the way a policy engine would: Submit data, the signed authorization message, the execution message inside it, then the transfer itself. Each layer decodes with stock Kit codecs, so the transfer reads exactly as it would outside the signer."
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
