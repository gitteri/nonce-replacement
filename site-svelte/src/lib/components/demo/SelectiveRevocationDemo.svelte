<script lang="ts">
	import type { Connection } from '@solana/web3.js';
	import { SystemProgram } from '@solana/web3.js';
	import { wallet, type WalletStore } from '$lib/wallet.svelte';
	import {
		Address,
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

	async function initLane(connection: Connection, wallet: WalletStore, feePayer: Address) {
		const { signingKey, identity } = generateIdentity();
		const pda = vectorPdaV1(identity);
		await sendV1(connection, wallet, [toV1Instruction(createInitializeEd25519Devnet(feePayer, identity))]);
		await sendV1(connection, wallet, [
			SystemProgram.transfer({ fromPubkey: wallet.publicKey!, toPubkey: pda, lamports: 5_000_000 })
		]);
		return { signingKey, identity, pda };
	}

	let withdrawLamports = $state(1_000);

	const demo = useDemoRunner();

	function onRun() {
		const withdraw = BigInt(Math.max(0, Math.round(withdrawLamports)));

		demo.run(async (addStep) => {
			const feePayer = toV3Address(wallet.publicKey!);

			const laneA = await initLane(connection, wallet, feePayer);
			const laneB = await initLane(connection, wallet, feePayer);
			addStep({
				label: 'Initialized lane A (to be revoked) and lane B (untouched)',
				detail: `A: ${laneA.pda.toBase58()}, B: ${laneB.pda.toBase58()}`,
				node: 'Init A + B'
			});

			const nonceA = (await fetchVectorAccountV1(connection, laneA.identity)).nonce;
			const withdrawA = createWithdrawSubinstruction(ED25519_DEVNET, laneA.identity, feePayer, withdraw);
			const passthroughA = createPassthroughInstruction(ED25519_DEVNET, laneA.identity, [withdrawA]);
			const payloadGuard = computeBudgetGuard();
			const payloadAdvanceA = toV1Instruction(
				signAdvanceEd25519Devnet(laneA.signingKey, nonceA, payloadGuard.v3, [passthroughA], feePayer)
			);
			const passthroughAV1 = toV1Instruction(passthroughA);
			addStep({
				label: 'Lane A: pre-signed a payload transaction',
				detail: 'holding it back, not broadcasting yet'
			});

			// Built via signAdvanceEd25519Devnet directly (not the signRevocationEd25519Devnet
			// convenience wrapper, which hardcodes empty pre/post) so the guard instructions
			// below are accounted for in the digest.
			const revokeGuard = computeBudgetGuard();
			const revokeIx = toV1Instruction(signAdvanceEd25519Devnet(laneA.signingKey, nonceA, revokeGuard.v3, []));
			const revokeSig = await sendV1(connection, wallet, [...revokeGuard.v1, revokeIx]);
			addStep({
				label: 'Lane A: submitted a revocation first',
				link: explorerLink(revokeSig),
				node: 'Revoke A'
			});

			try {
				const sig = await sendV1(connection, wallet, [...payloadGuard.v1, payloadAdvanceA, passthroughAV1]);
				addStep({ label: 'UNEXPECTED: revoked payload landed', detail: sig, node: 'Advance A' });
			} catch (err) {
				addStep({
					label: "Lane A's pre-signed payload rejected, as expected",
					detail: `${errorMessage(err)}. The account's nonce moved on when the revocation landed.`,
					node: 'Advance A (rejected)'
				});
			}

			const nonceB = (await fetchVectorAccountV1(connection, laneB.identity)).nonce;
			const withdrawB = createWithdrawSubinstruction(ED25519_DEVNET, laneB.identity, feePayer, withdraw);
			const passthroughB = createPassthroughInstruction(ED25519_DEVNET, laneB.identity, [withdrawB]);
			const guardB = computeBudgetGuard();
			const advanceB = toV1Instruction(
				signAdvanceEd25519Devnet(laneB.signingKey, nonceB, guardB.v3, [passthroughB], feePayer)
			);
			const sigB = await sendV1(connection, wallet, [...guardB.v1, advanceB, toV1Instruction(passthroughB)]);
			addStep({
				label: "Lane B: unaffected by lane A's revocation, lands fine",
				link: explorerLink(sigB),
				node: 'Advance B'
			});
		});
	}
</script>

<DemoCard
	connected={!!wallet.publicKey}
	description="Lane A pre-signs a payload, then its authority unilaterally revokes it before broadcast. The payload can no longer land. Lane B, a separate identity, is untouched."
	status={demo.status}
	steps={demo.steps}
	error={demo.error}
	{onRun}
>
	{#snippet params()}
		<NumberField label="Withdraw amount" bind:value={withdrawLamports} min={0} step={100} suffix="lamports" />
	{/snippet}
</DemoCard>
