# Programmatic Signer: devnet examples

Numbered scripts (`scripts/01-...` through `09-...`), one per functional requirement in
[`requirements/nonce-replacement-spec.md`](../../../requirements/nonce-replacement-spec.md). Each one
signs offline with a fresh cold key, lands the result through a relayer, and prints signatures with
Solana Explorer links.

## Status

All 9 scripts pass against a local `solana-test-validator` (Agave 4.2.1) with the three programs in
`.vendor/` deployed through `solana program deploy`, the same path a devnet deploy takes. `pnpm test`
checks the signing path offline: for a fixed key, nonce and payload, the Submit instruction, execution
message and next nonce match the Rust client's `presign` byte for byte.

They target this repo's own devnet deployment, which is not live yet (see below). The programs at the
canonical devnet addresses were deployed on 2026-09-22, before upstream moved the execution and
authorization messages from legacy to v1 (2026-09-25 to 09-29), so a v1 Submit passes the Signer's
signature check there and then panics in the Executor.

## Devnet deployment

Like Vector, this repo deploys its own copy. `.vendor/` holds the three programs built at upstream
`e3c948d` with only the `declare_id!` in each interface crate (and the Executor's default nonce program)
changed to these ids:

| Program  | Id                                             |
| -------- | ---------------------------------------------- |
| Signer   | `986H9i8wxYrDsUHtEUR9eNN2tA3Y5xgQDGsfRnhVmgzX` |
| Executor | `4NPokYh4xsQqs3dnwcJvuLPkuZCFj7x4QVQBChv8SDiQ` |
| Nonce    | `3nK4iiSeW7Mkx4GRxDXWWEw5H6ZPLG5yETB7JcZTdP5o` |

`lib/programs.ts` defaults to them. Set `PS_SIGNER_PROGRAM_ID`, `PS_EXECUTOR_PROGRAM_ID` and
`PS_NONCE_PROGRAM_ID` to target another deployment. To rebuild, replace the canonical ids in
`signer/interface/src/lib.rs`, `executor/interface/src/lib.rs`, `executor/interface/src/instruction.rs`
and `nonce/interface/src/lib.rs`, then run `cargo build-sbf` in each `*/program`.

Deploying all three costs about 1.89 SOL, paid by the CLI identity, which also becomes the upgrade
authority:

```
solana program deploy -u devnet --program-id .devnet/nonce-program.keypair.json .vendor/spl_nonce_program.so
solana program deploy -u devnet --program-id .devnet/executor-program.keypair.json .vendor/spl_message_executor_program.so
solana program deploy -u devnet --program-id .devnet/signer-program.keypair.json .vendor/spl_ed25519_signer_program.so
```

The ELFs are SBPF v0. Devnet still accepts v0 deployments, but `solana-test-validator` 4.2 enables
SIMD-0500 by default, which rejects them, so pass `--deactivate-feature
B8JJXCy5amZyWG9r7EnUYLwzXSXTxG7GZ1qZ1qggo83g` to rehearse a deploy locally.

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
  --bpf-program 986H9i8wxYrDsUHtEUR9eNN2tA3Y5xgQDGsfRnhVmgzX .vendor/spl_ed25519_signer_program.so \
  --bpf-program 4NPokYh4xsQqs3dnwcJvuLPkuZCFj7x4QVQBChv8SDiQ .vendor/spl_message_executor_program.so \
  --bpf-program 3nK4iiSeW7Mkx4GRxDXWWEw5H6ZPLG5yETB7JcZTdP5o .vendor/spl_nonce_program.so

# in another shell:
export DEVNET_RPC_URL=http://127.0.0.1:8899
export DEVNET_WS_URL=ws://127.0.0.1:8900
export TIME_WINDOW_WAIT_SECONDS=5
pnpm run 01   # ...through 09
```

Against devnet, leave `DEVNET_RPC_URL` unset or point it at a private endpoint. `DEVNET_WS_URL`
defaults to the RPC URL with `ws` in place of `http`.

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
.vendor/             the three programs at e3c948d, built with this repo's devnet ids
```
