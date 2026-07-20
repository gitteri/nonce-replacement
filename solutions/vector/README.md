# Vector

[Vector](https://github.com/blueshift-gg/vector) is Blueshift's offline-signing primitive for
Solana — a direct, deployed replacement for durable-nonce workflows. It's built on
[Pinocchio](https://github.com/anza-xyz/pinocchio) (native Rust, no Anchor), and ships as one
program per signature scheme (Ed25519, secp256k1, EIP-191, Falcon-512, Hawk-512). This repo only
targets the **Ed25519 program** (`vectorcLBXJ2TuoKuUygkEi6FWqvBnbHDEDWoYamfjV`), since that's what
Fireblocks and most institutional custodians already hold keys for.

## How it works

A transaction is built offline. Its signature region is temporarily replaced with a stored
`nonce` + `identity`, the full instruction buffer is SHA-256 hashed, and that digest — not the
transaction itself — is what gets signed by the custodial key. Onchain, the program reconstructs
the identical digest from the `Instructions` sysvar and checks the signature before executing
anything. On success, that same digest becomes the account's *next* nonce.

That last part is the core improvement over a plain durable nonce: it's a **hashchain, not a
monotonic counter**. Every future valid nonce is cryptographically dependent on the exact prior
transaction that was executed, so a pre-signed transaction can't be replayed or substituted
without invalidating everything signed against it.

Each identity gets its own PDA (`VectorAccount`, seeds `["vector", identity]`), a 65-byte account
holding the current `nonce`, a `bump`, and the `identity` itself — there's no separate authority
field, since the identity's signature *is* the authority.

Five instructions, shared across every signing scheme via `crates/common`:

| Instruction | Callable | Purpose |
|---|---|---|
| `Initialize` | top-level | Create the `VectorAccount`, store the identity, derive an unpredictable initial nonce from `SlotHashes` |
| `Advance` | top-level only | Verify the offchain signature against the recomputed digest; install that digest as the next nonce |
| `Passthrough` | top-level only | Find a prior sibling `Advance` for the same PDA earlier in the same transaction, then replay arbitrary CPIs with the PDA promoted to signer |
| `Close` | CPI-only, via `Passthrough` | Drain the PDA's lamports to a receiver |
| `Withdraw` | CPI-only, via `Passthrough` | Partial lamport withdrawal, preserving rent-exemption |

Signing one `Advance` transitively authorizes the exact bytes of a sibling `Passthrough` in the
same transaction — no second signature needed, because the digest covers the whole instructions
buffer.

## Requirement mapping

| # | Requirement | How Vector satisfies it | Fit |
|---|---|---|---|
| 1 | [Sign-to-broadcast time window](../../site/app/vector/time-window) | The nonce is a hashchain value with no blockhash-style expiry. Pair with a companion timeout program (e.g. an expiry check instruction) if a hard cap is wanted. | Full |
| 2 | [Concurrency](../../site/app/vector/concurrency) | One `VectorAccount` = one outstanding transaction at a time (signatures against the same nonce are mutually exclusive). N concurrent pre-signed transactions need N identities/accounts — a lane pool, same pattern as running a pool of durable-nonce accounts today. | Partial — lane-based, not unlimited-per-signer |
| 3 | [Fee-payer separation](../../site/app/vector/fee-payer-separation) | The digest hashes only the pre/advance/post instructions' own account metas, reconstructed from the instructions-sysvar wire format — there's no implicit fee-payer field. The fee payer only enters the digest if its pubkey is deliberately referenced as an account inside a signed instruction. | Full |
| 4 | [Transaction integrity](../../site/app/vector/transaction-integrity) | The digest cryptographically locks the exact instruction buffer (minus the 64-byte signature carve-out) at sign time. Anything appended or altered before broadcast invalidates the signature. | Full |
| 5 | [Selective revocation](../../site/app/vector/selective-revocation) | `sign_revocation_instruction_ed25519` signs an inert `Advance` (no pre/post instructions) at the currently outstanding nonce. Landing it advances the nonce with no side effects, permanently orphaning that lane's one outstanding transaction — other lanes are untouched. Unilateral, final, no counterparty needed. | Full (per-lane) |
| 6 | [No onchain footprint at sign time](../../site/app/vector/no-onchain-footprint) | Signing happens entirely offline against the currently-fetched nonce. Only the later `Advance`/`Passthrough` broadcast touches chain state. | Full |
| 7 | [Transaction parsability](../../site/app/vector/parsability) | `Passthrough` cleanly separates the `Advance` housekeeping instruction from the user's actual payload instructions, which remain standard, unwrapped, and inspectable offline. | Full |
| 8 | [State change tolerance](../../site/app/vector/state-change-tolerance) | `[Advance, Passthrough, ...]` lands as one atomic transaction — all or nothing, no partial execution. | Full |
| 9 | [Composability](../../site/app/vector/composability) | `Passthrough` CPIs via `invoke_signed`, so the PDA can hold and exercise arbitrary authorities (Vector's own tests demonstrate an SPL mint-authority round trip). Wallet-standard integration doesn't appear to exist yet. | Partial — CPI composability yes, wallet-standard no |

## Layout

```
rust/   mollusk-svm deterministic tests, one file per requirement
ts/     numbered devnet example scripts (01-09), one per requirement
```
