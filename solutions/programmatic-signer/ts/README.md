# Programmatic Signer: devnet examples

Numbered scripts (`scripts/01-...` through `09-...`), one per functional requirement in
[`requirements/nonce-replacement-spec.md`](../../../requirements/nonce-replacement-spec.md). Each one
signs offline with a fresh cold key, lands the result through a relayer, and prints signatures with
Solana Explorer links.

## Status

All 9 scripts pass against a local `solana-test-validator` (Agave 4.2.1) running the three programs
built at upstream `e3c948d`, the same ELFs as `../rust/fixtures`. `pnpm test` checks the signing path
offline: for a fixed key, nonce and payload, the Submit instruction, execution message and next nonce
match the Rust client's `presign` byte for byte.

They do not run on devnet yet. The programs at the canonical devnet addresses were deployed on
2026-09-22 (slots 502526991 to 502529229), before upstream moved the execution and authorization
messages from legacy to v1 (2026-09-25 to 09-29). The devnet Executor still parses a legacy message,
so a v1 Submit gets past the Signer's signature check and then panics in the Executor. They should run
unchanged once Anza redeploys a v1 build.

## Setup

Node 24 or newer.

```
pnpm install --ignore-workspace
```

This package keeps its own lockfile outside the repo's pnpm workspace. Adding it to the workspace
re-resolves the Next.js `site/` dependencies against Kit 8.

The JS client, `@solana-program/ed25519-programmatic-signer`, is not on npm. Its Codama source is
vendored at `e3c948d` under `vendor/ed25519-programmatic-signer` (Apache-2.0). It covers instruction
builders, account decoding and the PDA. `lib/programmaticSigner.ts` adds the offline signing that
the Rust client's `sign_and_submit` does: it compiles the execution message with the nonce in the
lifetime slot, wraps the Execute instruction in an authorization message, signs that with the cold
key, and computes successor nonces.

## Running

Against a local validator:

```
solana-test-validator --reset \
  --bpf-program EdSigVfK1DkeMrjFNDMjwfQaJPhPTtX7jW8uPv3oKEgN ../rust/fixtures/spl_ed25519_signer_program.so \
  --bpf-program ExecxgyHYsAXB4c5dZodV1zJZ9hqfsDCYkRDRATrpkFR ../rust/fixtures/spl_message_executor_program.so \
  --bpf-program Noncediea1fH12usShuQAz28UhgAeuE5Maf32LsMUQB ../rust/fixtures/spl_nonce_program.so

# in another shell:
export DEVNET_RPC_URL=http://127.0.0.1:8899
export TIME_WINDOW_WAIT_SECONDS=5
pnpm run 01   # ...through 09
```

Against devnet (once it carries a v1 build), leave `DEVNET_RPC_URL` unset or point it at a private
endpoint. `DEVNET_WS_URL` defaults to the RPC URL with `ws` in place of `http`.

Each script generates and funds its relayer keypair under `.devnet/` (gitignored by
`*.keypair.json`). Funding tries the faucet, then falls back to a transfer from
`~/.config/solana/id.json` or `DEVNET_FUNDER_KEYPAIR_PATH`. A run costs between 0.006 and 0.012 SOL,
mostly rent for nonce accounts (about 0.0014 SOL each) and the token accounts in `09`.

Script `01` waits 150 seconds between signing and landing, longer than a blockhash lives. Set
`TIME_WINDOW_WAIT_SECONDS` to change it.

## Layout

```
lib/                 devnet RPC, keypair funding, sendTx, Explorer links, and the offline signing path
                     (programmaticSigner.ts) plus per-script setup of cold key, PDA and nonce accounts
scripts/01-09        one script per functional requirement
test/                byte-for-byte parity with the Rust client
vendor/              upstream Codama JS client at e3c948d
```
