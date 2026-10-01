<script lang="ts">
	import { wallet } from '$lib/wallet.svelte';
	import {
		computeBudgetGuard,
		connection,
		createInitializeEd25519Devnet,
		explorerAccountLink,
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
	import { useDemoRunner } from '$lib/demo/useDemoRunner.svelte';

	const demo = useDemoRunner();

	function onRun() {
		demo.run(async (addStep) => {
			const feePayer = toV3Address(wallet.publicKey!);
			const { signingKey, identity } = generateIdentity();
			const pda = vectorPdaV1(identity);

			const initIx = toV1Instruction(createInitializeEd25519Devnet(feePayer, identity));
			const initSig = await sendV1(connection, wallet, [initIx]);
			addStep({
				label: 'Initialized vector account',
				detail: `PDA ${pda.toBase58()}`,
				link: explorerLink(initSig),
				node: 'Initialize'
			});

			const before = await fetchVectorAccountV1(connection, identity);
			addStep({ label: 'Fetched starting nonce', detail: hex(before.nonce) });

			const signedAt = new Date();
			const guard = computeBudgetGuard();
			const advanceIx = toV1Instruction(
				signAdvanceEd25519Devnet(signingKey, before.nonce, guard.v3, [], feePayer)
			);
			addStep({
				label: `Signed an advance at ${signedAt.toLocaleTimeString()}`,
				detail:
					'The digest folds in the nonce and instruction bytes only, no blockhash and no ' +
					'expiry. These exact bytes verify identically if broadcast a day from now. A ' +
					'regular Solana transaction expires in 60-90 seconds once its blockhash ages out.'
			});

			const advanceSig = await sendV1(connection, wallet, [...guard.v1, advanceIx]);
			addStep({ label: 'Landed the advance', link: explorerLink(advanceSig), node: 'Advance' });

			const after = await fetchVectorAccountV1(connection, identity);
			addStep({
				label: 'Nonce advanced',
				detail: hex(after.nonce),
				link: explorerAccountLink(pda.toBase58())
			});
		});
	}
</script>

<DemoCard
	connected={!!wallet.publicKey}
	description="Initializes a fresh vector account, signs an advance now, and lands it. The signed digest carries no blockhash and no expiry."
	status={demo.status}
	steps={demo.steps}
	error={demo.error}
	{onRun}
/>
