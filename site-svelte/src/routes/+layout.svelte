<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>Nonce Replacement</title>
	<meta
		name="description"
		content="Requirement-by-requirement look at Solana nonce account replacement solutions"
	/>
</svelte:head>

{@render children()}
