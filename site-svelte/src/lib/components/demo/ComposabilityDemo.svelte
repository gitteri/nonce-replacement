<script lang="ts">
	import { Keypair, SystemProgram } from '@solana/web3.js';
	import {
		AuthorityType,
		createAssociatedTokenAccountInstruction,
		createInitializeMint2Instruction,
		createMintToInstruction,
		createSetAuthorityInstruction,
		getAccount,
		getAssociatedTokenAddressSync,
		getMint,
		MINT_SIZE,
		TOKEN_PROGRAM_ID
	} from '@solana/spl-token';
	import { wallet } from '$lib/wallet.svelte';
	import {
		asV3Instruction,
		computeBudgetGuard,
		connection,
		createInitializeEd25519Devnet,
		createPassthroughInstruction,
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
	import { useDemoRunner } from '$lib/demo/useDemoRunner.svelte';

	let mintAmount = $state(10_000);

	const demo = useDemoRunner();

	function onRun() {
		const amount = Math.max(0, Math.round(mintAmount));

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

			const mint = Keypair.generate();
			const rentExempt = await connection.getMinimumBalanceForRentExemption(MINT_SIZE);
			const createMintSig = await sendV1(
				connection,
				wallet,
				[
					SystemProgram.createAccount({
						fromPubkey: wallet.publicKey!,
						newAccountPubkey: mint.publicKey,
						space: MINT_SIZE,
						lamports: rentExempt,
						programId: TOKEN_PROGRAM_ID
					}),
					createInitializeMint2Instruction(mint.publicKey, 6, pda, null)
				],
				[mint]
			);
			addStep({
				label: 'Created an SPL mint with authority set to the vector PDA',
				detail: mint.publicKey.toBase58(),
				link: explorerLink(createMintSig),
				node: 'Create Mint'
			});

			const destination = getAssociatedTokenAddressSync(mint.publicKey, wallet.publicKey!);
			const ataSig = await sendV1(connection, wallet, [
				createAssociatedTokenAccountInstruction(wallet.publicKey!, destination, wallet.publicKey!, mint.publicKey)
			]);
			addStep({
				label: 'Created destination token account',
				detail: destination.toBase58(),
				link: explorerLink(ataSig),
				node: 'Create ATA'
			});

			const pdaToEoa = createSetAuthorityInstruction(mint.publicKey, pda, AuthorityType.MintTokens, wallet.publicKey!);
			const mintToIx = createMintToInstruction(mint.publicKey, destination, wallet.publicKey!, amount);
			const eoaToPda = createSetAuthorityInstruction(mint.publicKey, wallet.publicKey!, AuthorityType.MintTokens, pda);

			const passthroughIx = createPassthroughInstruction(ED25519_DEVNET, identity, [asV3Instruction(pdaToEoa)]);
			const postIxs = [passthroughIx, asV3Instruction(mintToIx), asV3Instruction(eoaToPda)];

			const account = await fetchVectorAccountV1(connection, identity);
			const guard = computeBudgetGuard();
			const advanceIx = toV1Instruction(
				signAdvanceEd25519Devnet(signingKey, account.nonce, guard.v3, postIxs, feePayer)
			);
			addStep({ label: 'One signed advance: PDA to EOA authority, mint, EOA back to PDA authority' });

			const sig = await sendV1(connection, wallet, [
				...guard.v1,
				advanceIx,
				toV1Instruction(passthroughIx),
				mintToIx,
				eoaToPda
			]);
			addStep({ label: 'Landed the round trip', link: explorerLink(sig), node: 'Advance + Passthrough' });

			const tokenInfo = await getAccount(connection, destination);
			const mintInfo = await getMint(connection, mint.publicKey);
			const authorityMatches = mintInfo.mintAuthority?.equals(pda) ?? false;
			addStep({
				label: 'Verified: minted, authority restored to the PDA',
				detail: `minted ${tokenInfo.amount} base units. Mint authority ${mintInfo.mintAuthority?.toBase58()}, matches PDA: ${authorityMatches}.`
			});

			addStep({
				label: 'Gap noted',
				detail:
					'Standard SPL Token instructions worked with zero Vector-specific tooling on the mint ' +
					'side. There is no wallet-standard adapter for Vector yet, so this bridging is bespoke.'
			});
		});
	}
</script>

<DemoCard
	connected={!!wallet.publicKey}
	description="Uses passthrough to hand an SPL mint's authority from the vector PDA to the connected wallet, mint tokens, and hand authority back, all authorized by a single signed advance."
	status={demo.status}
	steps={demo.steps}
	error={demo.error}
	{onRun}
>
	{#snippet params()}
		<NumberField label="Mint amount" bind:value={mintAmount} min={0} step={1000} suffix="base units" />
	{/snippet}
</DemoCard>
