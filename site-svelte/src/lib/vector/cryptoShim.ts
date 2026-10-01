// Browser-safe stand-in for Node's `crypto.createHash`, covering only what
// vector-sdk's scheme.js actually calls: `createHash("sha256").update(bytes).digest()`
// (used to hash PDA seeds/identities longer than 32 bytes — not exercised by the
// ed25519 scheme this site uses, but the import is static, so Vite's client bundle
// needs *something* resolvable here regardless). Backed by @noble/hashes, which
// vector-sdk already depends on, so no extra dependency is introduced.
import { sha256 } from '@noble/hashes/sha2.js';

class BrowserHash {
	private algorithm: string;
	private chunks: Uint8Array[] = [];

	constructor(algorithm: string) {
		this.algorithm = algorithm;
	}

	update(data: Uint8Array): this {
		this.chunks.push(data);
		return this;
	}

	digest(): Uint8Array {
		if (this.algorithm !== 'sha256') {
			throw new Error(`Unsupported hash algorithm in browser crypto shim: ${this.algorithm}`);
		}
		const total = this.chunks.reduce((n, c) => n + c.length, 0);
		const buf = new Uint8Array(total);
		let offset = 0;
		for (const chunk of this.chunks) {
			buf.set(chunk, offset);
			offset += chunk.length;
		}
		return sha256(buf);
	}
}

export function createHash(algorithm: string): BrowserHash {
	return new BrowserHash(algorithm);
}
