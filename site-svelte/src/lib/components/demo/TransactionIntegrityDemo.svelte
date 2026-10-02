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
		sendV1,
		signAdvanceEd25519Devnet,
		toV1Instruction,
		toV3Address,
		vectorPdaV1
	} from '$lib/vector';
	import DemoCard from './DemoCard.svelte';
	import NumberField from './NumberField.svelte';
	import { errorMessage, useDemoRunner } from '$lib/demo/useDemoRunner.svelte';

	let intendedLamports = $state(1_000);
	let tamperedLamports = $state(5_000_000);

	const demo = useDemoRunner();

	function onRun() {
		const intended = BigInt(Math.max(0, Math.round(intendedLamports)));
		const tampered = BigInt(Math.max(0, Math.round(tamperedLamports)));

		demo.run(async (addStep) => {
			const feePayer = toV3Address(wallet.publicKey!);
			const { signingKey, identity } = generateIdentity();
			const pda = vectorPdaV1(identity);

			await sendV1(connection, wallet, [toV1Instruction(createInitializeEd25519Devnet(feePayer, identity))]);
			const fundSig = await sendV1(connection, wallet, [
				SystemProgram.transfer({ fromPubkey: wallet.publicKey!, toPubkey: pda, lamports: 5_000_000 })
			]);
			addStep({
				label: 'Initialized and funded vector PDA',
				detail: pda.toBase58(),
				link: explorerLink(fundSig),
				node: 'Init + Fund'
			});

			const account = await fetchVectorAccountV1(connection, identity);
			const intendedWithdraw = createWithdrawSubinstruction(ED25519_DEVNET, identity, feePayer, intended);
			const passthroughIx = createPassthroughInstruction(ED25519_DEVNET, identity, [intendedWithdraw]);
			const guard = computeBudgetGuard();
			const advanceIx = toV1Instruction(
				signAdvanceEd25519Devnet(signingKey, account.nonce, guard.v3, [passthroughIx], feePayer)
			);
			addStep({ label: `Signed: withdraw ${intended} lamports to the fee payer` });

			const tamperedWithdraw = createWithdrawSubinstruction(ED25519_DEVNET, identity, feePayer, tampered);
			const tamperedPassthroughIx = toV1Instruction(
				createPassthroughInstruction(ED25519_DEVNET, identity, [tamperedWithdraw])
			);
			addStep({
				label: `Tampered: swapped in a ${tampered} lamport withdrawal before broadcast`,
				detail: 'same advance instruction, different payload'
			});

			const before = await connection.getAccountInfo(pda);
			try {
				const sig = await sendV1(connection, wallet, [...guard.v1, advanceIx, tamperedPassthroughIx]);
				addStep({ label: 'UNEXPECTED: tampered transaction landed', detail: sig, node: 'Advance' });
			} catch (err) {
				addStep({
					label: 'Tampered transaction rejected on-chain, as expected',
					detail: errorMessage(err),
					node: 'Advance (rejected)'
				});
			}

			const after = await connection.getAccountInfo(pda);
			addStep({
				label: 'Vector PDA lamports unchanged',
				detail:
					`${before?.lamports} -> ${after?.lamports}. The fee payer's own transaction signature ` +
					"was valid. The program's internal digest check is what caught the tamper."
			});
		});
	}
</script>

<DemoCard
	connected={!!wallet.publicKey}
	description="Signs an advance committing to a withdrawal, then swaps in a different amount before broadcast. The on-chain digest check rejects the whole transaction."
	status={demo.status}
	steps={demo.steps}
	error={demo.error}
	{onRun}
>
	{#snippet params()}
		<NumberField label="Intended withdraw" bind:value={intendedLamports} min={0} step={100} suffix="lamports" />
		<NumberField label="Tampered withdraw" bind:value={tamperedLamports} min={0} step={1000} suffix="lamports" />
	{/snippet}
</DemoCard>
