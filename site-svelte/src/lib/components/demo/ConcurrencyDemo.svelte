<script lang="ts">
	import { wallet } from '$lib/wallet.svelte';
	import {
		computeBudgetGuard,
		connection,
		createInitializeEd25519Devnet,
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
	import { useDemoRunner } from '$lib/demo/useDemoRunner.svelte';

	let laneCount = $state(3);

	const demo = useDemoRunner();

	function onRun() {
		const count = Math.max(2, Math.min(5, Math.round(laneCount)));

		demo.run(async (addStep) => {
			const feePayer = toV3Address(wallet.publicKey!);

			const lanes = [];
			for (let i = 0; i < count; i++) {
				const { signingKey, identity } = generateIdentity();
				const pda = vectorPdaV1(identity);
				const initIx = toV1Instruction(createInitializeEd25519Devnet(feePayer, identity));
				const sig = await sendV1(connection, wallet, [initIx]);
				lanes.push({ signingKey, identity, pda });
				addStep({
					label: `Lane ${i}: initialized`,
					detail: `PDA ${pda.toBase58()}`,
					link: explorerLink(sig),
					node: `Init ${i}`
				});
			}

			const advanceTxs = [];
			for (let i = 0; i < lanes.length; i++) {
				const account = await fetchVectorAccountV1(connection, lanes[i].identity);
				const guard = computeBudgetGuard();
				const advanceIx = toV1Instruction(
					signAdvanceEd25519Devnet(lanes[i].signingKey, account.nonce, guard.v3, [], feePayer)
				);
				advanceTxs.push([...guard.v1, advanceIx]);
				addStep({
					label: `Lane ${i}: pre-signed one advance`,
					detail: `against nonce ${hex(account.nonce)}`
				});
			}
			addStep({
				label: "Each lane's signature is independent",
				detail:
					'a custodian can maintain a pool of these lanes and issue one pre-signed ' +
					'transaction per lane per ceremony, with no cross-lane ordering constraint.'
			});

			const signatures = await Promise.all(advanceTxs.map((ixs) => sendV1(connection, wallet, ixs)));
			signatures.forEach((sig, i) => {
				addStep({ label: `Lane ${i}: landed`, link: explorerLink(sig), node: `Advance ${i}` });
			});

			addStep({ label: `All ${count} lanes landed independently and succeeded` });
		});
	}
</script>

<DemoCard
	connected={!!wallet.publicKey}
	description="Initializes independent vector identities (lanes) and pre-signs one advance per lane, landed together. Batched pre-signing does not serialize on a single shared nonce."
	status={demo.status}
	steps={demo.steps}
	error={demo.error}
	{onRun}
>
	{#snippet params()}
		<NumberField label="Lanes" bind:value={laneCount} min={2} max={5} />
	{/snippet}
</DemoCard>
