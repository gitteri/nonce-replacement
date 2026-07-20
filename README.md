# Nonce Replacement

Solana durable nonce accounts let custodians and institutional users build and sign transactions
offline without a fresh blockhash. But a plain durable nonce is a predictable monotonic counter —
every future value is known in advance, which is exactly the structural weakness behind the
~$270M Drift Protocol admin-key exploit (April 2026): a pre-signed transaction sat valid for over
a week and was substituted without invalidating the original signature.

[`requirements/nonce-replacement-spec.md`](requirements/nonce-replacement-spec.md) lays out the
institutional use cases (cold wallet ceremonies, policy-gated signing, staking ops, token
administration, OTC/RFQ settlement) and distills them into 9 functional requirements any
nonce-replacement mechanism has to satisfy. This repo builds concrete examples and an interactive
website proving, requirement by requirement, how each candidate solution measures up.

## Solutions

- **[Vector](solutions/vector/)** (live) — [Blueshift's](https://github.com/blueshift-gg/vector)
  hashchain-based offline-signing program. Deterministic Rust tests, devnet TypeScript examples,
  and a requirement-by-requirement mapping live in `solutions/vector/`.
- **ed25519-programmatic-signer** (coming soon) — Anza's in-development
  [programmatic signer program](https://github.com/solana-program/ed25519-programmatic-signer/pull/12),
  as a second comparison track.

## Site

`site/` is a Next.js app with one page per functional requirement, each showing the spec text,
the relevant use case, how the solution satisfies it (or doesn't), and a live devnet demo.

```
pnpm install
pnpm --filter site dev
```

## Repo layout

```
requirements/            the spec every solution is measured against
solutions/vector/         Vector: architecture notes, Rust tests, TS devnet scripts
site/                     interactive requirement-by-requirement website
```
