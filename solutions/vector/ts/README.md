# Vector — devnet examples

Numbered scripts (`scripts/01-...` through `09-...`), one per functional requirement in
[`requirements/nonce-replacement-spec.md`](../../../requirements/nonce-replacement-spec.md). Each
one uses Vector's actual TypeScript SDK to build and land real transactions, printing the
resulting signature plus a Solana Explorer link so you can verify on-chain yourself.

## Status

All 9 scripts are verified end-to-end against a local `solana-test-validator` (Agave 3.1.8)
running the real, unmodified Vector Ed25519 program. Public devnet deployment is written up below
and code-identical (same scripts, just point `DEVNET_RPC_URL` at devnet and use a devnet-deployed
`VECTOR_DEVNET_PROGRAM_ID`) but is currently blocked on funding — see "Devnet deployment" below.

## Devnet deployment

Vector's canonical Ed25519 program (`vectorcLBXJ2TuoKuUygkEi6FWqvBnbHDEDWoYamfjV`) is not deployed
on devnet or mainnet-beta — `getAccountInfo` returns `null` for that address on both clusters (the
Vector repo's own tooling only ever runs it against a local `solana-test-validator`, e.g. its
`package.json`'s `validator` script). These scripts deploy the same on-chain program — compiled
from [blueshift-gg/vector](https://github.com/blueshift-gg/vector)'s `programs/ed25519`, vendored
at `.vendor/vector_ed25519.so` — to devnet under a self-generated program ID instead, since we
don't hold the private key for the canonical vanity address. `lib/vectorProgram.ts` documents why
and re-derives the SDK's `*Ed25519` convenience wrappers (which hardcode the canonical program ID)
against this program ID instead.

To deploy:

```
solana-keygen new -o .devnet/vector-ed25519.keypair.json   # first time only
solana program deploy \
  --url devnet \
  --program-id .devnet/vector-ed25519.keypair.json \
  .vendor/vector_ed25519.so
export VECTOR_DEVNET_PROGRAM_ID=$(solana-keygen pubkey .devnet/vector-ed25519.keypair.json)
```

Deploying a ~212KB program needs about **1.48 SOL** in the deploying/upgrade-authority wallet
(rent-exemption for the program + program-data accounts). As of this writing that deploy is
blocked in this environment: the devnet airdrop faucet is rate-limited per IP and returns
`"You've either reached your airdrop limit today"` on every attempt, and the only funded local
wallet (`~/.config/solana/id.json`) holds 1.3536 SOL — about 0.13 SOL short. Fund that wallet (or
the deploy keypair directly) at https://faucet.solana.com, or wait for the daily limit to reset,
then run the deploy command above.

### Local-validator fallback (already verified)

To exercise all 9 scripts right now without devnet funding, run against a local validator loaded
with the same program at its canonical address (no deploy-cost rent required — genesis-loaded
programs don't need to be paid for):

```
solana-test-validator \
  --bpf-program vectorcLBXJ2TuoKuUygkEi6FWqvBnbHDEDWoYamfjV .vendor/vector_ed25519.so \
  --reset

# in another shell:
export DEVNET_RPC_URL=http://127.0.0.1:8899
export VECTOR_DEVNET_PROGRAM_ID=vectorcLBXJ2TuoKuUygkEi6FWqvBnbHDEDWoYamfjV
pnpm exec tsx scripts/01-time-window.ts   # ...through 09
```

**Use Agave/solana-test-validator ≥ 3.1.x.** Agave 3.0.13 has a real bug that breaks Vector's
`initialize` instruction: the CPI that creates the `VectorAccount` PDA (via `pinocchio_system`'s
`CreateAccount`, funded from `Rent::get()`) lands the account under-funded, and the transaction is
rejected post-execution with `InsufficientFundsForRent` on the PDA — even though the program's own
logs report success and an equivalent CPI-created PDA from an unrelated program (e.g. SPL's
Associated Token Account program) funds correctly on the same validator. Upgrading the local
validator to 3.1.8 (`agave-install init 3.1.8`) fixes it outright with no code changes on our side.
Public devnet reports `apiVersion: 4.2.0-beta.1`, so this is very unlikely to reproduce there, but
if a devnet run ever hits `InsufficientFundsForRent` on `initialize`, this is the first thing to
check.

## Setup

```
pnpm install
```

`vector-sdk` is Vector's real TypeScript SDK, vendored from
[blueshift-gg/vector](https://github.com/blueshift-gg/vector) (`master`) into
`.vendor/vector/` (gitignored) and installed as a local `link:` dependency. A plain
`"github:blueshift-gg/vector#master"` git dependency is the cleaner approach and is what this
started with, but pnpm's git-tarball fetch for this specific repo was consistently unreliable in
this environment (repeated `ECONNRESET`/truncated-download failures across several independent
attempts, both via `pnpm install` directly and via raw `git clone`/`curl`) — vendoring a verified
full copy sidesteps that flakiness while still building and running the real, unmodified SDK
source untouched. (`file:` was tried first but pnpm packs `file:` deps respecting the package's
`"files"` allowlist, which excludes `tsconfig.json`; `link:` symlinks the real directory instead.)
`postinstall` runs the SDK's own `tsc` build (it ships without a prebuilt `dist/`).

To refresh the vendored copy from upstream:

```
curl -sL -o /tmp/vector.tar.gz https://codeload.github.com/blueshift-gg/vector/tar.gz/refs/heads/master
rm -rf .vendor/vector && tar -xzf /tmp/vector.tar.gz -C .vendor && mv .vendor/vector-master .vendor/vector
pnpm install
```

Each script auto-generates and airdrop-funds whatever devnet keypairs it needs under `.devnet/`
(gitignored — matches the repo's `*.keypair.json` pattern). Devnet's airdrop faucet is
rate-limited per IP; if it's exhausted, funding falls back to a transfer from your local Solana
CLI identity (`~/.config/solana/id.json`, or `DEVNET_FUNDER_KEYPAIR_PATH`) — fund that manually at
https://faucet.solana.com if it's empty too.

`@solana/web3.js@3.0.0-rc.0`'s bundled output also references a `__VERSION__` global its own build
tooling is meant to inject at publish time; running it directly under Node (no consuming bundler)
leaves it unset and throws on `new Connection(...)`. `lib/connection.ts` defines it manually as a
workaround. Separately, that same rc's default preflight `simulateTransaction` path throws a
spurious error even on successful simulations (the thrown message embeds the program's own
"success" log line) — `lib/sendTx.ts` wraps every send with `skipPreflight: true` to avoid it; real
on-chain failures still surface correctly via the post-submit confirmation status.

## Running

```
export VECTOR_DEVNET_PROGRAM_ID=<deployed program address>
pnpm exec tsx scripts/01-time-window.ts
pnpm exec tsx scripts/02-concurrency.ts
pnpm exec tsx scripts/03-fee-payer-separation.ts
pnpm exec tsx scripts/04-transaction-integrity.ts
pnpm exec tsx scripts/05-selective-revocation.ts
pnpm exec tsx scripts/06-no-onchain-footprint.ts
pnpm exec tsx scripts/07-parsability.ts
pnpm exec tsx scripts/08-state-change-tolerance.ts
pnpm exec tsx scripts/09-composability.ts
```

Or via the `package.json` shortcuts: `pnpm run 01` … `pnpm run 09`.

## Layout

```
lib/                shared helpers: devnet connection, keypair funding, Explorer links, sendTx,
                     spl-token web3.js-v3 compat shim, and the devnet-Scheme bridge (vectorProgram.ts)
scripts/01-09        one script per functional requirement
.vendor/             vendored vector-sdk source + the compiled vector_ed25519.so (gitignored)
.devnet/             generated/funded devnet keypairs (gitignored)
```
