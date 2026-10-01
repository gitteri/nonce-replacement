// Direct access to vector-sdk's own web3.js major version (3.0.0-rc.0, aliased as
// "vector-web3js-v3" in package.json since the rest of the site runs on v1 for
// wallet-adapter compatibility). Only `Address` (== `PublicKey` in this rc) and the
// `TransactionInstruction` type are needed here; every actual instruction the site
// sends is built via vector-sdk's own builders and then bridged to a v1
// TransactionInstruction in bridge.ts before being handed to a connected wallet.
//
// Mirrors the `__VERSION__` workaround in solutions/vector/ts/lib/connection.ts:
// this rc's bundled output references a global its own build tooling is supposed to
// inject at publish time. The site never constructs a v3 `Connection` (all reads go
// through the wallet-adapter's v1 connection instead — see account.ts), so this is
// unlikely to be hit, but it's a harmless one-liner to define defensively.
(globalThis as unknown as { __VERSION__?: string }).__VERSION__ ??= "3.0.0-rc.0";

export { Address } from "vector-web3js-v3";
export type { TransactionInstruction as V3TransactionInstruction } from "vector-web3js-v3";
