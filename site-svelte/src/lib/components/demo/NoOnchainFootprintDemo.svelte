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
	import { useDemoRunner } from '$lib/demo/useDemoRunner.svelte';

	const demo = useDemoRunner();

	function onRun() {
		demo.run(async (addStep) => {
			const feePayer = toV3Address(wallet.publicKey!);
			const { signingKey, identity } = generateIdentity();
			const pda = vectorPdaV1(identity);

			const initSig = await sendV1(connection, wallet, [
				toV1Instruction(createInitializeEd25519Devnet(feePayer, identity))
			]);
			addStep({
				label: 'Initialized vector account (network)',
				detail: pda.toBase58(),
				link: explorerLink(initSig),
				node: 'Initialize'
			});

			const account = await fetchVectorAccountV1(connection, identity);
			addStep({
				label: 'Fetched the nonce once, ahead of time (the one network read)',
				detail: hex(account.nonce)
			});

			const guard = computeBudgetGuard();

			const originalFetch = globalThis.fetch;
			let fetchCalls = 0;
			globalThis.fetch = ((...args: Parameters<typeof fetch>) => {
				fetchCalls++;
				return originalFetch(...args);
			}) as typeof fetch;

			let advanceIx;
			try {
				// Pure computation: digest + Ed25519 sign, no connection reference at all.
				advanceIx = toV1Instruction(
					signAdvanceEd25519Devnet(signingKey, account.nonce, guard.v3, [], feePayer)
				);
			} finally {
				globalThis.fetch = originalFetch;
			}

			if (fetchCalls !== 0) {
				throw new Error(`expected zero network calls while signing, saw ${fetchCalls}`);
			}
			addStep({
				label: 'Signed fully offline',
				detail:
					`fetch() calls made while signing: ${fetchCalls}. A valid, ready-to-broadcast ` +
					'signature was produced with no RPC round-trip and no on-chain state change, so ' +
					'nothing here signals intent to an observer watching the chain.'
			});

			const advanceSig = await sendV1(connection, wallet, [...guard.v1, advanceIx]);
			addStep({
				label: 'Only now does the network get touched: broadcast',
				link: explorerLink(advanceSig),
				node: 'Advance'
			});
		});
	}
</script>

<DemoCard
	connected={!!wallet.publicKey}
	description="Fetches the nonce once, ahead of time, then signs the advance digest entirely offline, counting fetch() calls to prove zero network activity happens during signing."
	status={demo.status}
	steps={demo.steps}
	error={demo.error}
	{onRun}
/>
