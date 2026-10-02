<script lang="ts">
	import { SystemProgram } from '@solana/web3.js';
	import { wallet } from '$lib/wallet.svelte';
	import {
		computeBudgetGuard,
		connection,
		createInitializeEd25519Devnet,
		createPassthroughInstruction,
		createWithdrawSubinstruction,
		ED25519_DEVNET,
		explorerLink,
		fetchVectorAccountV1,
		generateIdentity,
		hex,
		sendV1,
		signAdvanceEd25519Devnet,
		toV1Instruction,
		toV3Address,
		vectorPdaV1
	} from '$lib/vector';
	import DemoCard from './DemoCard.svelte';
	import NumberField from './NumberField.svelte';
	import { errorMessage, useDemoRunner } from '$lib/demo/useDemoRunner.svelte';

	let doomedSol = $state(1);

	const demo = useDemoRunner();

	function onRun() {
		const doomedLamports = BigInt(Math.max(0, Math.round(doomedSol * 1e9)));

		demo.run(async (addStep) => {
			const feePayer = toV3Address(wallet.publicKey!);
			const { signingKey, identity } = generateIdentity();
			const pda = vectorPdaV1(identity);

			await sendV1(connection, wallet, [toV1Instruction(createInitializeEd25519Devnet(feePayer, identity))]);
			const fundSig = await sendV1(connection, wallet, [
				SystemProgram.transfer({ fromPubkey: wallet.publicKey!, toPubkey: pda, lamports: 5_000_000 })
			]);
			const before = await connection.getAccountInfo(pda);
			const nonceBefore = (await fetchVectorAccountV1(connection, identity)).nonce;
			addStep({
				label: 'Initialized and lightly funded vector PDA',
				detail: `${pda.toBase58()}, ${before?.lamports} lamports`,
				link: explorerLink(fundSig),
				node: 'Init + Fund'
			});

			const doomedWithdraw = createWithdrawSubinstruction(ED25519_DEVNET, identity, feePayer, doomedLamports);
			const passthroughIx = createPassthroughInstruction(ED25519_DEVNET, identity, [doomedWithdraw]);
			const guard = computeBudgetGuard();
			const advanceIx = toV1Instruction(
				signAdvanceEd25519Devnet(signingKey, nonceBefore, guard.v3, [passthroughIx], feePayer)
			);
			const passthroughV1 = toV1Instruction(passthroughIx);
			addStep({
				label: `Signed an advance whose passthrough withdraws ${doomedLamports} lamports, far more than the PDA holds`
			});

			try {
				const sig = await sendV1(connection, wallet, [...guard.v1, advanceIx, passthroughV1]);
				addStep({ label: 'UNEXPECTED: this should not have landed', detail: sig, node: 'Advance' });
			} catch (err) {
				addStep({
					label: 'Transaction failed atomically, as expected',
					detail: errorMessage(err),
					node: 'Advance (rejected)'
				});
			}

			const after = await connection.getAccountInfo(pda);
			const nonceAfter = (await fetchVectorAccountV1(connection, identity)).nonce;
			const nonceUnchanged = hex(nonceBefore) === hex(nonceAfter);
			addStep({
				label: 'Verified: no partial execution',
				detail:
					`lamports ${before?.lamports} -> ${after?.lamports}, unchanged. ` +
					`Nonce ${nonceUnchanged ? 'unchanged' : 'CHANGED, unexpected'}.`
			});
		});
	}
</script>

<DemoCard
	connected={!!wallet.publicKey}
	description="Submits an advance whose inner CPI withdraws more lamports than the PDA holds, guaranteed to fail. The whole transaction reverts atomically, including the nonce update."
	status={demo.status}
	steps={demo.steps}
	error={demo.error}
	{onRun}
>
	{#snippet params()}
		<NumberField label="Doomed withdraw" bind:value={doomedSol} min={0} step={0.1} suffix="SOL" />
	{/snippet}
</DemoCard>
