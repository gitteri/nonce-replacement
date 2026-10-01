<script lang="ts">
	import { base } from '$app/paths';
	import { page } from '$app/state';
	import WalletConnectButton from '$lib/components/WalletConnectButton.svelte';
	import RequirementNav from '$lib/components/RequirementNav.svelte';

	let { children } = $props();
</script>

<div class="mx-auto flex min-h-screen max-w-6xl gap-8 px-6 py-8">
	<aside class="sticky top-8 hidden h-fit w-64 shrink-0 lg:block">
		<a href="{base}/" class="text-sm font-medium">Nonce Replacement</a>
		<div class="mt-2 text-xs text-neutral-500">Vector</div>
		<div class="mt-4">
			<WalletConnectButton />
		</div>
		<div class="mt-6">
			<RequirementNav activeSlug={page.params.requirement} />
		</div>
	</aside>
	<div class="min-w-0 flex-1">
		{@render children()}
	</div>
</div>
