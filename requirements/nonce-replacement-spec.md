# Nonce Account Replacement: Use Case Specification

Transcribed from the internal spec doc of the same name. This is the source of truth every
candidate solution in `solutions/` is measured against. If you read nothing else in this repo,
read the **Functional Requirements** section below — it's the actual spec each solution's tests,
scripts, and website pages are built to satisfy.

## Why this exists

Solana durable nonce accounts let you build and sign a transaction offline, without a recent
blockhash, by substituting a durable nonce value for the blockhash. Institutional custodians
(Fireblocks and similar, or their users) lean on this heavily for anything that can't complete
within a ~60-90 second blockhash window: multi-approver signing ceremonies, policy review,
deferred settlement. But a plain durable nonce is a monotonic counter — every future nonce value
is predictable and independently valid — which creates real custody risk once a pre-signed
transaction is allowed to sit outstanding for any meaningful length of time.

## 1. Background — institutional use cases

### Cold Wallet Signing Ceremonies
Manual, multi-step signing with hardware devices; the ceremony itself is the bottleneck (physical
security protocols, multiple approvers, air-gapped environments).
- **Time window:** 5 minutes to 2 days, depending on ceremony complexity and approver count.
- **Concurrency:** 2-20 transactions per session, batched for efficiency; may include independent
  and ordered groups.
- **What's unique:** the ceremony is expensive to schedule and execute. Re-signing is not a
  "retry" — it's another ceremony. Any solution that assumes re-signing is cheap breaks this use
  case.

### Policy-Gated Signing (Variable Latency)
Standard transactions complete in under 60 seconds, but certain types trigger extended review
(independent payload validation, compliance checks, additional approval tiers).
- **Time window:** bimodal — 5-30 seconds normally, 1-30 minutes when policy triggers review.
- **Concurrency:** low, typically one at a time, but a user may initiate more during a review
  window.
- **What's unique:** the solution cannot impose a uniform time penalty on all transactions to
  accommodate the occasional slow one — the fast path must stay fast. Policy engines may reject
  after partial signing, so clean abandonment without on-chain side effects is required. DeFi
  interactions are especially sensitive here.

### Staking Operations (Cold Withdraw Authority)
Withdraw authority (and possibly stake authority) held in cold storage; recurring operations
include validator rotation, merge/split, and rebalancing.
- **Time window:** 30 minutes to 2 hours (same ceremony constraints as cold wallets).
- **Concurrency:** low; a rebalancing ceremony for 10-30 validators produces multiple
  transactions with possible ordering dependencies — parallelism isn't reflective of transaction
  count.
- **What's unique:** similar constraints to token administration ceremonies; validators may want
  to pre-sign transactions for operations that require waiting on epoch boundaries.

### Token Administration (Multi-Role Authority)
Mint, freeze, seize, and pausable authorities are distributed across signers with different
policies; authority-change operations (transfer/revoke) are the highest-sensitivity case.
- **Time window:** routine (mint) operations take 5-30 minutes; other operations take 1-24 hours
  due to signer accessibility and approval cycles.
- **Concurrency:** low per authority type, but multiple authority wallets may have pending
  operations on different tokens simultaneously.
- **What's unique:** authority-change operations may carry regulatory reporting obligations — the
  signing and execution flow must produce artifacts (timestamps, signatures, causal ordering)
  that fit into existing compliance workflows. Ordering dependencies exist across authority types
  on the same token. Must work with Token-2022 extensions — specifically **Transfer Hooks,
  Confidential Transfers, and Default Account State**.

### OTC Settlement / RFQ Flows
Counterparties negotiate off-chain; one side pre-signs settlement while awaiting confirmation or
an external condition (price oracle, compliance clearance, credit check).
- **Time window:** 30 minutes to 48 hours (some RFQ flows close in minutes, others involve
  overnight compliance review).
- **Concurrency:** medium; a desk may have 5-20 open RFQ positions simultaneously, each with a
  pre-signed settlement transaction.
- **What's unique:** pre-signed transactions are held by a counterparty, not just by the signer's
  own infrastructure. This makes revocation critical and qualitatively different from other use
  cases — you need to invalidate a transaction that someone else possesses and is incentivized to
  broadcast. Pre-signing preserves direct asset custody, keeps intent private until execution,
  avoids smart contract risk, and maintains the legal/compliance status of the assets.

## 2. Functional Requirements (the spec)

1. **Sign-to-Broadcast Time Window** — must support an extended sign-to-broadcast time window
   beyond what blockhashes provide today. Does not need to support an infinite time window; can
   be capped at a day or two if helpful.

2. **Concurrency** — a single signing authority should be able to sign multiple pre-signed
   transactions to be broadcast simultaneously. Batching is the norm, not the exception: cold
   wallet ceremonies, staking rebalances, treasury ops, and deferred settlement all produce
   multiple transactions per session.

3. **Fee-Payer Separation** — signing authority and fee-payer can be different keys. Fee-payer
   selection at broadcast time (not sign time) is a nice-to-have. Many institutional cold wallets
   hold zero SOL for compliance/accounting reasons; fee-payer infrastructure is often shared
   across many signing authorities, with selection based on balance and availability.

4. **Transaction Integrity** — the signed payload must not be alterable by the fee-payer or any
   other party between signing and broadcast. The signing authority's intent (destination,
   amount, program invocation, parameters) must be cryptographically locked at sign time.
   Signatures must be scoped to the action they sign for, not applicable to other or additional
   instructions added to the transaction at broadcast time.

5. **Selective Revocation** — must be possible to revoke a specific pre-signed transaction
   without affecting any other outstanding transaction from the same authority. Revocation must
   be unilateral (no counterparty cooperation) and final (cannot be reversed).

6. **No Onchain Footprint at Sign Time** — an extended sign-to-broadcast window must not rely on
   onchain state updates such as buffer accounts. Any mechanism that touches chain state at sign
   time signals intent to observers. Non-negotiable for trading/settlement use cases, undesirable
   for all others.

7. **Transaction Parsability** — the core transaction payload must be inspectable by external
   systems, often in offline environments (cold wallet infrastructure). Policy engines validate
   payloads against user intent; operational systems check transaction validity between signing
   and broadcast. Any structural additions the mechanism introduces (wrapper instructions,
   metadata, nonce-like references) must be cleanly separable from the user's intended
   instructions.

8. **State Change Tolerance** — no silent partial execution or unexpected behavior. Systems must
   be able to check validity offchain before submitting to the network.

9. **Composability** — must work with existing DeFi applications, wallet infrastructure, and
   other standard tooling, or have a clear upgrade path. Ideally includes integration with the
   wallet standard.

## 3. Cross-cutting constraints called out across use cases

- Cheap, unilateral revocation without counterparty cooperation (OTC/RFQ).
- No onchain footprint / no observable intent signal at sign time (policy-gated + trading/
  settlement).
- Fast path must not be slowed down for the rare slow-review case (policy-gated signing).
- Compliance/audit artifact generation — timestamps, signatures, causal/ordering guarantees
  (token administration).
- Token-2022 extension compatibility: Transfer Hooks, Confidential Transfers, Default Account
  State (token administration).
- Support for ordering dependencies across multi-transaction ceremonies (staking, token
  administration).

The doc does not name candidate mechanisms — it is purely the use-case and requirements spec that
any proposed solution should be tested against. That's what `solutions/` does, one candidate at a
time.
