# Ed25519 Programmatic Signer

[Ed25519 Programmatic Signer](https://www.solana-program.com/docs/programmatic-signer) is Anza's
offline-signing system for Solana, developed in
[solana-program/ed25519-programmatic-signer](https://github.com/solana-program/ed25519-programmatic-signer).
It is three cooperating Pinocchio programs with canonical addresses on devnet and nothing on
mainnet-beta yet:

| Program | Address | Role |
|---|---|---|
| Signer | `EdSigVfK1DkeMrjFNDMjwfQaJPhPTtX7jW8uPv3oKEgN` | Verifies offline Ed25519 signatures, promotes the signer's PDA |
| Message Executor | `ExecxgyHYsAXB4c5dZodV1zJZ9hqfsDCYkRDRATrpkFR` | Checks and consumes the nonce, then replays the signed instructions |
| Nonce | `Noncediea1fH12usShuQAz28UhgAeuE5Maf32LsMUQB` | Stores and advances nonce values |

Status as of 2026-10-01: the README says "under construction", the docs say audits come before v1
and any mainnet deployment, and interfaces are still being renamed (latest commit `e3c948d`,
2026-09-29). Everything here is pinned to that commit. The canonical devnet deployment is older
(2026-09-22) and still uses legacy messages, so it rejects what `e3c948d` clients sign. The scripts
use this repo's own `e3c948d` deployment instead, as Vector's do. See [`ts/`](ts/).

## How it works

The cold key signs a serialized v1 Solana message offline. That "authorization message" holds one
instruction, `Executor::Execute`, whose data is a second v1 message, the "execution message", with
the user's actual instructions. The execution message's `lifetime_specifier` field carries the
expected nonce instead of a blockhash.

Any relayer can land it later by sending `Signer::Submit { signatures, message }` and paying the
fee:

1. Signer checks the Ed25519 signatures in program (`brine_ed25519`, no precompile or instructions
   sysvar), checks the submitted accounts match the message's keys in order, and only allows
   `Executor::Execute` as the target.
2. Signer CPIs into Executor with the PDA `["programmatic-signer", cold_authority]` promoted to
   signer. The PDA holds no data. It is the address that owns funds and authorities.
3. Executor requires `lifetime_specifier == stored nonce`, CPIs `Nonce::Advance` first, then CPIs
   each inner instruction with the exact privileges in the message header. Any failure rolls the
   whole transaction back, including the advance.

The nonce is a hashchain. Advancing sets
`next = sha256("spl-nonce::step::v1" || program_id || nonce_account || old_nonce || commitment)`,
where Executor passes `commitment = sha256(execution_message)`. Successors are computable offline,
so a signer can pre-sign an ordered chain on one nonce account where each transaction only becomes
valid after the previous one lands. Advancing with any other commitment orphans the rest of that
chain.

Nonce accounts are 72 bytes (nonce, authority, `initialize_slot`), created by the caller, owned by
the Nonce program, and rent-exempt. One authority can own any number of them. With the CLI's
`--cold-authority` flag, the stored authority is the cold key's PDA, so only a signed Submit can
advance it.

Instruction set, all with a one-byte discriminator:

| Program | Instruction | Purpose |
|---|---|---|
| Signer | `0 Submit` | `[sig_count][sigs][authorization message]`, accounts mirror the message keys, none signing |
| Executor | `0 Execute` | `[execution message]`, accounts are nonce authority, nonce account, Nonce program, then message keys |
| Nonce | `0 Initialize` | Seed the nonce from `SlotHashes`, store the authority |
| Nonce | `1 Advance` | Requires the authority and the current nonce, installs the next value |
| Nonce | `2 Withdraw` | Lamport withdrawal, a full withdrawal closes the account (not in the slot it was initialized) |

## Requirement mapping

| # | Requirement | How Programmatic Signer satisfies it | Fit |
|---|---|---|---|
| 1 | Sign-to-broadcast time window | No clock or slot check anywhere in Signer or Executor. A signature stays valid until the nonce advances. A hard cap needs an extra instruction inside the signed payload. | Full |
| 2 | Concurrency | One authority controls any number of nonce accounts, one per concurrent transaction, all under the same PDA. Ordered batches can also be pre-signed as a chain on a single nonce account. | Full |
| 3 | Fee-payer separation | Submit takes no signers from the cold key's side. The relayer signs and pays, and its key is not part of the signed bytes unless deliberately referenced in the payload. | Full |
| 4 | Transaction integrity | The signature covers the full serialized authorization message, which embeds every payload instruction and account. The relayer can add its own top-level instructions around Submit, but those never get the PDA's signer privilege. | Full |
| 5 | Selective revocation | Sign an Execute with an empty payload at the outstanding nonce. Landing it advances that nonce account with a different commitment and orphans whatever was signed against it. Other nonce accounts are untouched. | Full (per nonce account) |
| 6 | No onchain footprint at sign time | Signing is an offline computation over the nonce value, which is predictable after the account is created. Nothing touches chain state until Submit lands. | Full |
| 7 | Transaction parsability | The payload is a standard v1 Solana message nested inside Submit instruction data, so a policy engine has to decode two message layers before it sees the user's instructions. The CLI ships `transaction decode` for this. | Partial: standard format, but wrapped |
| 8 | State change tolerance | Submit, Execute, the nonce advance and every payload CPI run inside one Solana transaction. Any failure reverts all of it, nonce included. | Full |
| 9 | Composability | Executor CPIs arbitrary programs with the PDA as signer. Payload programs run two CPI levels below the top-level instruction, which leaves less nesting budget for programs that CPI further. The JS client (`@solana-program/ed25519-programmatic-signer`, Kit based) is not on npm yet, and there is no wallet-standard integration. | Partial: CPI yes, tooling early |

Compared with [Vector](../vector/): Vector's signature covers the whole transaction's instruction
buffer and keeps one outstanding transaction per identity. Programmatic Signer signs a self-contained
message, which frees the relayer to wrap it, and gets concurrency from many nonce accounts per
authority instead of one identity per lane.

## Tests

`rust/` holds mollusk-svm tests, one file per requirement, run against the three program ELFs in
`rust/fixtures/` (built with `cargo build-sbf` at upstream `e3c948d`).

```
cd rust && cargo test
```

`ts/` holds numbered scripts `01` through `09` built on the upstream JS client (vendored, since it
is not on npm). They pass against a local validator with this repo's own build deployed, and target
that build's devnet ids. Details are in [`ts/README.md`](ts/README.md).

## Next

- Site: `site-svelte` has a `/programmatic-signer` track with the nine requirement pages. Seven of them
  have live demos (`site-svelte/src/lib/programmatic-signer`), which show a notice until this repo's
  programs are on devnet. Parsability and composability are still to come.
