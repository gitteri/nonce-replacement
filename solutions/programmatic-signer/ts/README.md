# Programmatic Signer: devnet examples

Numbered scripts (`scripts/01-...` through `09-...`), one per functional requirement in
[`requirements/nonce-replacement-spec.md`](../../../requirements/nonce-replacement-spec.md). Each one
signs offline with a fresh cold key, lands the result through a relayer, and prints signatures with
Solana Explorer links.

## Status

All 9 scripts pass on devnet (2026-10-07) against Anza's canonical programs. `pnpm test` checks
the signing path offline: for a fixed key, nonce and payload, the Submit instruction, execution
message and next nonce match the Rust client's `presign` byte for byte.

## Programs

| Program  | Id                                             |
| -------- | ---------------------------------------------- |
| Signer   | `EdSigVfK1DkeMrjFNDMjwfQaJPhPTtX7jW8uPv3oKEgN` |
| Executor | `ExecxgyHYsAXB4c5dZodV1zJZ9hqfsDCYkRDRATrpkFR` |
| Nonce    | `Noncediea1fH12usShuQAz28UhgAeuE5Maf32LsMUQB` |

`lib/programs.ts` defaults to them. Set `PS_SIGNER_PROGRAM_ID`, `PS_EXECUTOR_PROGRAM_ID` and
`PS_NONCE_PROGRAM_ID` to target another deployment.

Until 2026-10-07 the canonical programs predated upstream's move to v1 messages, so this repo ran
its own `e3c948d` build at `986H9i8w...`, `4NPokYh4...` and `3nK4iiSe...`. Those are still on devnet
but nothing here uses them, and they reject Submit from the current client (see below).

Upstream `5a679d1` made each Submit signature optional (`Vec<Option<Signature>>`), so every
signature now carries a one byte option tag. Clients older than that commit fail against the
canonical programs, and current clients fail against older builds.

## Setup

Node 24 or newer.

```
pnpm install --ignore-workspace
```

This package keeps its own lockfile outside the repo's pnpm workspace. Adding it to the workspace
re-resolves the Next.js `site/` dependencies against Kit 8.

The JS client, `@solana-program/ed25519-programmatic-signer`, is not on npm. Its Codama source is
vendored at `5a679d1` under `vendor/ed25519-programmatic-signer` (Apache-2.0). It covers instruction
builders, account decoding and the PDA. `lib/programmaticSigner.ts` adds the offline signing that
the Rust client's `sign_and_submit` does: it compiles the execution message with the nonce in the
lifetime slot, wraps the Execute instruction in an authorization message, signs that with the cold
key, and computes successor nonces.

## Running

Against a local validator, loading the program bytes dumped from devnet into `../rust/fixtures/`:

```
solana-test-validator --reset \
  --bpf-program EdSigVfK1DkeMrjFNDMjwfQaJPhPTtX7jW8uPv3oKEgN ../rust/fixtures/spl_ed25519_signer_program.so \
  --bpf-program ExecxgyHYsAXB4c5dZodV1zJZ9hqfsDCYkRDRATrpkFR ../rust/fixtures/spl_message_executor_program.so \
  --bpf-program Noncediea1fH12usShuQAz28UhgAeuE5Maf32LsMUQB ../rust/fixtures/spl_nonce_program.so

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
vendor/              upstream Codama JS client at 5a679d1
```
