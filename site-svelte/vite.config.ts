import { fileURLToPath } from 'url';
import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig({
	plugins: [
		// @solana/web3.js and @solana/spl-token reference Node's `Buffer` global at module
		// scope (not just inside functions), so it must exist before those modules are
		// evaluated in the browser — Vite doesn't polyfill Node globals by default the way
		// webpack/Next.js does.
		nodePolyfills({ include: ['buffer'], globals: { Buffer: true, global: false, process: true } }),
		tailwindcss(),
		sveltekit()
	],
	resolve: {
		alias: {
			// vector-sdk statically imports Node's `crypto` for a sha256 helper that our
			// ed25519-only usage never actually calls, but Rollup still needs a resolvable
			// module for the client bundle. See src/lib/vector/cryptoShim.ts.
			crypto: fileURLToPath(new URL('./src/lib/vector/cryptoShim.ts', import.meta.url))
		}
	}
});
