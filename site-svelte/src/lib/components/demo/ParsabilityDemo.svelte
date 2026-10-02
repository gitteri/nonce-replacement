<script lang="ts">
	import { Keypair, SystemInstruction, SystemProgram } from '@solana/web3.js';
	import { wallet } from '$lib/wallet.svelte';
	import {
		asV3Instruction,
		computeBudgetGuard,
		connection,
		createInitializeEd25519Devnet,
		explorerLink,
		fetchVectorAccountV1,
		generateIdentity,
		sendV1,
		signAdvanceEd25519Devnet,
		toV1Instruction,
		toV3Address,
		vectorPdaV1
	} from '$lib/vector';
	import DemoCard from './DemoCard.svelte';
	import NumberField from './NumberField.svelte';
	import { useDemoRunner } from '$lib/demo/useDemoRunner.svelte';

	let transferLamports = $state(1_000_000);

	const demo = useDemoRunner();

	function onRun() {
		const lamports = Math.max(0, Math.round(transferLamports));

		demo.run(async (addStep) => {
			const feePayer = toV3Address(wallet.publicKey!);
			const { signingKey, identity } = generateIdentity();
			const pda = vectorPdaV1(identity);

			const initSig = await sendV1(connection, wallet, [
				toV1Instruction(createInitializeEd25519Devnet(feePayer, identity))
			]);
			addStep({
				label: 'Initialized vector account',
				detail: pda.toBase58(),
				link: explorerLink(initSig),
				node: 'Initialize'
			});

			const account = await fetchVectorAccountV1(connection, identity);
			const destination = Keypair.generate().publicKey;
			const payloadIx = SystemProgram.transfer({
				fromPubkey: wallet.publicKey!,
				toPubkey: destination,
				lamports
			});
			const guard = computeBudgetGuard();
			const advanceIx = toV1Instruction(
				signAdvanceEd25519Devnet(signingKey, account.nonce, guard.v3, [asV3Instruction(payloadIx)], feePayer)
			);

			const decoded = SystemInstruction.decodeTransfer(payloadIx);
			addStep({
				label: 'Payload is a plain System transfer, decoded independently with no Vector wrapping',
				detail: `from ${decoded.fromPubkey.toBase58()} to ${decoded.toPubkey.toBase58()}, ${decoded.lamports} lamports, via web3.js's stock SystemInstruction.decodeTransfer`
			});

			const sig = await sendV1(connection, wallet, [...guard.v1, advanceIx, payloadIx]);
			addStep({ label: 'Landed advance and payload', link: explorerLink(sig), node: 'Advance + Payload' });
		});
	}
</script>

<DemoCard
	connected={!!wallet.publicKey}
	description="Builds [advance, payload] where the payload is a plain System transfer. Any standard Solana tool can parse it exactly as it would without Vector in the picture at all."
	status={demo.status}
	steps={demo.steps}
	error={demo.error}
	{onRun}
>
	{#snippet params()}
		<NumberField label="Transfer amount" bind:value={transferLamports} min={0} step={1000} suffix="lamports" />
	{/snippet}
</DemoCard>
