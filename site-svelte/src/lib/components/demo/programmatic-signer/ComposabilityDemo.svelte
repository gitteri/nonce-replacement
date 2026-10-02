<script lang="ts">
	import { Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
	import {
		createAssociatedTokenAccountIdempotentInstruction,
		createInitializeMint2Instruction,
		createMintToInstruction,
		createTransferCheckedInstruction,
		getAccount,
		getAssociatedTokenAddressSync,
		MINT_SIZE,
		TOKEN_PROGRAM_ID
	} from '@solana/spl-token';
	import { wallet } from '$lib/wallet.svelte';
	import { connection, explorerLink, sendV1 } from '$lib/vector';
	import {
		fetchStoredNonce,
		fromV1Instruction,
		presign,
		PROGRAM_IDS,
		setupSigner,
		toV1Instruction
	} from '$lib/programmatic-signer';
	import DemoCard from '../DemoCard.svelte';
	import NumberField from '../NumberField.svelte';
	import { useDemoRunner } from '$lib/demo/useDemoRunner.svelte';
	import DeploymentGate from './DeploymentGate.svelte';

	const DECIMALS = 6;
	const MINTED = 10_000_000n;

	let transferAmount = $state(2_500_000);

	const demo = useDemoRunner();

	function onRun() {
		const amount = BigInt(Math.max(0, Math.round(transferAmount)));

		demo.run(async (addStep) => {
			const payer = wallet.publicKey!;
			const { cold, pda, nonceAccounts, setupSignature } = await setupSigner(connection, wallet, PROGRAM_IDS);
			const [nonceAccount] = nonceAccounts;
			addStep({
				label: 'Created a nonce account under a fresh cold key',
				detail: `PDA ${pda}`,
				link: explorerLink(setupSignature),
				node: 'Setup'
			});

			const pdaKey = new PublicKey(pda);
			const mint = Keypair.generate();
			const pdaAta = getAssociatedTokenAddressSync(mint.publicKey, pdaKey, true);
			const walletAta = getAssociatedTokenAddressSync(mint.publicKey, payer);
			const rentExempt = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
			const tokenSig = await sendV1(
				connection,
				wallet,
				[
					SystemProgram.createAccount({
						fromPubkey: payer,
						newAccountPubkey: mint.publicKey,
						space: MINT_SIZE,
						lamports: rentExempt,
						programId: TOKEN_PROGRAM_ID
					}),
					createInitializeMint2Instruction(mint.publicKey, DECIMALS, payer, null),
					createAssociatedTokenAccountIdempotentInstruction(payer, pdaAta, pdaKey, mint.publicKey),
					createAssociatedTokenAccountIdempotentInstruction(payer, walletAta, payer, mint.publicKey),
					createMintToInstruction(mint.publicKey, pdaAta, payer, MINTED)
				],
				[mint]
			);
			addStep({
				label: `Created an SPL mint and minted ${MINTED} base units to the PDA's token account`,
				detail: `mint ${mint.publicKey.toBase58()}, PDA token account ${pdaAta.toBase58()}`,
				link: explorerLink(tokenSig),
				node: 'Token setup'
			});

			const nonce = await fetchStoredNonce(connection, nonceAccount);
			const { submit } = await presign(PROGRAM_IDS, cold, nonceAccount, nonce, [
				fromV1Instruction(
					createTransferCheckedInstruction(pdaAta, mint.publicKey, walletAta, pdaKey, amount, DECIMALS)
				)
			]);
			addStep({
				label: `Cold key signed a stock SPL TransferChecked of ${amount} base units with the PDA as owner`,
				detail: 'Built with @solana/spl-token, no signer-specific token code'
			});

			const sig = await sendV1(connection, wallet, [toV1Instruction(submit)]);
			addStep({
				label: 'Landed: Submit, then Execute, then the Token program, two CPI levels down',
				link: explorerLink(sig),
				node: 'Submit'
			});

			const [pdaBalance, walletBalance] = await Promise.all(
				[pdaAta, walletAta].map(async (ata) => (await getAccount(connection, ata, 'confirmed')).amount)
			);
			addStep({
				label: 'Verified the token balances',
				detail: `PDA token account ${pdaBalance}, wallet token account ${walletBalance} (base units)`
			});
		});
	}
</script>

<DeploymentGate>
	<DemoCard
		connected={!!wallet.publicKey}
		description="Gives the programmatic signer an SPL token account, then has the cold key sign a plain TransferChecked with the PDA as owner. The Executor promotes the PDA to signer and calls the Token program, so any program that accepts a PDA authority works unchanged."
		status={demo.status}
		steps={demo.steps}
		error={demo.error}
		{onRun}
	>
		{#snippet params()}
			<NumberField label="Transfer amount" bind:value={transferAmount} min={0} max={10_000_000} step={100_000} suffix="base units" />
		{/snippet}
	</DemoCard>
</DeploymentGate>
