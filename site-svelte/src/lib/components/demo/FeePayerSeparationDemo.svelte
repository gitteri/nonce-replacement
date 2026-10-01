<script lang="ts">
	import { Keypair, SystemProgram } from '@solana/web3.js';
	import { wallet } from '$lib/wallet.svelte';
	import {
		connection,
		createInitializeEd25519Devnet,
		explorerLink,
		fetchVectorAccountV1,
		generateIdentity,
		sendV1,
		sendWithKeypair,
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
			const initPayer = toV3Address(wallet.publicKey!);
			const { signingKey, identity } = generateIdentity();
			const pda = vectorPdaV1(identity);

			const initIx = toV1Instruction(createInitializeEd25519Devnet(initPayer, identity));
			const initSig = await sendV1(connection, wallet, [initIx]);
			addStep({
				label: 'Initialized vector account, paid by the connected wallet',
				detail: `PDA ${pda.toBase58()}`,
				link: explorerLink(initSig),
				node: 'Initialize'
			});

			const broadcastPayer = Keypair.generate();
			const fundIx = SystemProgram.transfer({
				fromPubkey: wallet.publicKey!,
				toPubkey: broadcastPayer.publicKey,
				lamports: 0.01e9
			});
			const fundSig = await sendV1(connection, wallet, [fundIx]);
			addStep({
				label: 'Funded a completely unrelated broadcast payer',
				detail: broadcastPayer.publicKey.toBase58(),
				link: explorerLink(fundSig),
				node: 'Fund'
			});

			const account = await fetchVectorAccountV1(connection, identity);
			// feePayer omitted on purpose: the digest doesn't fold in any fee payer, so any
			// fee-payer can broadcast this later, chosen at broadcast time.
			const advanceIx = toV1Instruction(signAdvanceEd25519Devnet(signingKey, account.nonce, [], []));
			addStep({
				label: 'Signed the advance with no fee payer bound at sign time',
				detail: 'the signature does not commit to who broadcasts it'
			});

			const advanceSig = await sendWithKeypair(connection, broadcastPayer, [advanceIx]);
			addStep({
				label: 'Landed, paid entirely by the unrelated broadcast payer',
				detail: `${broadcastPayer.publicKey.toBase58()} never appears in the advance instruction's accounts`,
				link: explorerLink(advanceSig),
				node: 'Advance'
			});
		});
	}
</script>

<DemoCard
	connected={!!wallet.publicKey}
	description="Signs an advance with the custodial identity key, then lands it with a completely different, separately-funded fee payer that never appears in the signed instructions."
	status={demo.status}
	steps={demo.steps}
	error={demo.error}
	{onRun}
/>
