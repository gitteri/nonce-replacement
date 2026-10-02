<script lang="ts">
	import { getTransferSolInstruction } from '@solana-program/system';
	import { address, createNoopSigner } from '@solana/kit';
	import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
	import { wallet } from '$lib/wallet.svelte';
	import { connection, explorerLink, sendV1, sendWithKeypair } from '$lib/vector';
	import {
		fetchStoredNonce,
		presign,
		PROGRAM_IDS,
		setupSigner,
		toV1Instruction
	} from '$lib/programmatic-signer';
	import { useDemoRunner } from '$lib/demo/useDemoRunner.svelte';
	import DemoCard from '../DemoCard.svelte';
	import DeploymentGate from './DeploymentGate.svelte';

	const demo = useDemoRunner();

	const balance = (account: string) => connection.getBalance(new PublicKey(account), 'confirmed');

	function onRun() {
		demo.run(async (addStep) => {
			const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(
				connection,
				wallet,
				PROGRAM_IDS,
				{ pdaLamports: 2_000_000 }
			);
			const [nonceAccount] = nonceAccounts;
			addStep({
				label: 'Created a nonce account under a fresh cold key, paid by your wallet',
				detail: `cold key ${cold.address} holds ${await balance(cold.address)} lamports`,
				link: explorerLink(setupSignature),
				node: 'Setup'
			});

			const nonce = await fetchStoredNonce(connection, nonceAccount);
			const presigned = await presign(PROGRAM_IDS, cold, nonceAccount, nonce, [
				getTransferSolInstruction({
					source: createNoopSigner(pda),
					destination: address(wallet.publicKey!.toBase58()),
					amount: 1_000n
				})
			]);
			addStep({
				label: 'Cold key signed a transfer offline, before any relayer was picked',
				detail: `${presigned.authorizationMessage.length} signed bytes, none of them a relayer key`
			});

			const relayer = Keypair.generate();
			const fundSig = await sendV1(connection, wallet, [
				SystemProgram.transfer({
					fromPubkey: wallet.publicKey!,
					toPubkey: relayer.publicKey,
					lamports: 1_000_000
				})
			]);
			addStep({
				label: 'Funded an unrelated relayer',
				detail: relayer.publicKey.toBase58(),
				link: explorerLink(fundSig),
				node: 'Fund relayer'
			});

			const before = await balance(relayer.publicKey.toBase58());
			const signature = await sendWithKeypair(connection, relayer, [toV1Instruction(presigned.submit)]);
			const paid = before - (await balance(relayer.publicKey.toBase58()));
			addStep({
				label: `Landed by the relayer, which paid ${paid} lamports in fees`,
				detail: `cold key still holds ${await balance(cold.address)} lamports and never signed a transaction`,
				link: explorerLink(signature),
				node: 'Submit'
			});
		});
	}
</script>

<DeploymentGate>
	<DemoCard
		connected={!!wallet.publicKey}
		description="A cold key with no SOL signs a transfer offline. A relayer funded afterwards lands it and pays the fee, since the signed bytes don't name a fee payer."
		status={demo.status}
		steps={demo.steps}
		error={demo.error}
		{onRun}
	/>
</DeploymentGate>
