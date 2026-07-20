export type Fit = "full" | "partial";

export interface Requirement {
  number: number;
  slug: string;
  title: string;
  spec: string;
  useCase: string;
  mechanism: string;
  fit: Fit;
  fitNote: string;
  scriptFile: string;
  testFile: string;
}

export const requirements: Requirement[] = [
  {
    number: 1,
    slug: "time-window",
    title: "Sign-to-Broadcast Time Window",
    spec: "Must support an extended sign-to-broadcast time window beyond what blockhashes provide today. Does not need to support an infinite time window — can be capped at a day or two if helpful.",
    useCase: "Cold wallet signing ceremonies run 5 minutes to 2 days depending on approver count and ceremony complexity. A blockhash's ~60-90 second expiry makes it useless for this — re-signing isn't a retry, it's another ceremony.",
    mechanism: "A Vector nonce is a hashchain value, not a blockhash. It has no built-in expiry, so a signature stays valid until something actually advances the chain. A companion timeout/expiry check instruction can be layered on top if a hard cap is wanted.",
    fit: "full",
    fitNote: "No expiry by default; capping is opt-in, not a constraint you're fighting.",
    scriptFile: "01-time-window.ts",
    testFile: "no_onchain_footprint.rs",
  },
  {
    number: 2,
    slug: "concurrency",
    title: "Concurrency",
    spec: "A single signing authority should be able to sign multiple pre-signed transactions to be broadcast simultaneously. Batching is the norm, not the exception: cold wallet ceremonies, staking rebalances, treasury ops, and deferred settlement all produce multiple transactions per session.",
    useCase: "A validator rebalancing ceremony can produce 10-30 transactions with ordering dependencies; a desk running OTC/RFQ flows may have 5-20 open positions simultaneously, each needing its own pre-signed settlement.",
    mechanism: "One VectorAccount (one identity) allows exactly one outstanding pre-signed transaction at a time — signatures against the same nonce are mutually exclusive. Concurrency comes from running a pool of N identities/accounts, one per lane, exactly the pattern custodians already use with pools of durable-nonce accounts today.",
    fit: "partial",
    fitNote: "Concurrency is lane-based, not unlimited-per-signer. This is the honest operating model, not a workaround to hide.",
    scriptFile: "02-concurrency.ts",
    testFile: "concurrency_lanes.rs",
  },
  {
    number: 3,
    slug: "fee-payer-separation",
    title: "Fee-Payer Separation",
    spec: "Signing authority and fee-payer can be different keys. Fee-payer selection at broadcast time (not sign time) is a nice-to-have. Many institutional cold wallets hold zero SOL for compliance/accounting reasons.",
    useCase: "Fee-payer infrastructure is typically shared across many signing authorities, with the specific payer chosen at broadcast time based on balance and availability — not known when the cold wallet signs.",
    mechanism: "The signed digest hashes only the pre/advance/post instructions' own account metas (the instructions-sysvar wire format) — there's no implicit fee-payer field. The fee payer only enters the hash if its pubkey is deliberately referenced as an account inside a signed instruction. Otherwise it's free to be chosen at broadcast time.",
    fit: "full",
    fitNote: "Verified directly against Vector's digest.rs: the digest is fee-payer-independent by construction.",
    scriptFile: "03-fee-payer-separation.ts",
    testFile: "fee_payer_separation.rs",
  },
  {
    number: 4,
    slug: "transaction-integrity",
    title: "Transaction Integrity",
    spec: "The signed payload must not be alterable by the fee-payer or any other party between signing and broadcast. Signatures must be scoped to the action they sign for, not applicable to other or additional instructions added at broadcast time.",
    useCase: "The signing authority's intent — destination, amount, program invocation, parameters — must be cryptographically locked at sign time. This is the property a monotonic-counter durable nonce doesn't give you: nothing stops a future transaction from being substituted for the one you thought you signed.",
    mechanism: "The digest is a SHA-256 hash of the exact instruction buffer (minus the 64-byte signature carve-out) at sign time. Any byte changed, or any instruction appended, produces a different hash and fails on-chain verification.",
    fit: "full",
    fitNote: "This is the core property the hashchain design exists to guarantee.",
    scriptFile: "04-transaction-integrity.ts",
    testFile: "transaction_integrity.rs",
  },
  {
    number: 5,
    slug: "selective-revocation",
    title: "Selective Revocation",
    spec: "Must be possible to revoke a specific pre-signed transaction without affecting any other outstanding transaction from the same authority. Revocation must be unilateral (no counterparty cooperation) and final.",
    useCase: "OTC/RFQ settlement is the sharpest version of this: a pre-signed transaction is held by a counterparty, not just your own infrastructure. You need to invalidate something someone else possesses and is incentivized to broadcast.",
    mechanism: "sign_revocation_instruction_ed25519 produces an inert Advance (no pre/post instructions) signed at the currently outstanding nonce. Landing it advances the nonce with zero side effects, permanently orphaning that lane's one outstanding transaction. Other lanes (other identities) are untouched.",
    fit: "full",
    fitNote: "Full fit at the lane level: revoking one lane never touches another lane's outstanding transaction.",
    scriptFile: "05-selective-revocation.ts",
    testFile: "selective_revocation.rs",
  },
  {
    number: 6,
    slug: "no-onchain-footprint",
    title: "No Onchain Footprint at Sign Time",
    spec: "An extended sign-to-broadcast window must not rely on onchain state updates such as buffer accounts. Any mechanism that touches chain state at sign time signals intent to observers.",
    useCase: "Non-negotiable for trading/settlement: a policy engine or DeFi counterparty watching the chain shouldn't be able to see that a transaction is about to happen just because you started the signing ceremony.",
    mechanism: "Signing happens entirely offline against a nonce value fetched ahead of time — no RPC calls, no writes, at sign time. The only on-chain footprint is the eventual Advance/Passthrough transaction itself, exactly when you choose to broadcast it.",
    fit: "full",
    fitNote: "Signing is a pure offline computation; nothing touches the network until you decide to land it.",
    scriptFile: "06-no-onchain-footprint.ts",
    testFile: "no_onchain_footprint.rs",
  },
  {
    number: 7,
    slug: "parsability",
    title: "Transaction Parsability",
    spec: "The core transaction payload must be inspectable by external systems, often offline. Structural additions the mechanism introduces must be cleanly separable from the user's intended instructions.",
    useCase: "Policy engines validate payloads against user intent, and operational systems check validity between signing and broadcast — frequently in offline cold-wallet infrastructure that can't call out to a live parser.",
    mechanism: "Passthrough cleanly separates the Advance housekeeping instruction from the user's actual payload instructions. The payload instructions themselves are standard, unwrapped Solana instructions — a policy engine can parse them exactly like it would any other transaction.",
    fit: "full",
    fitNote: "The wrapper (Advance/Passthrough) and the payload are structurally distinct, not interleaved.",
    scriptFile: "07-parsability.ts",
    testFile: "parsability.rs",
  },
  {
    number: 8,
    slug: "state-change-tolerance",
    title: "State Change Tolerance",
    spec: "No silent partial execution or unexpected behavior. Systems must be able to check validity offchain before submitting to the network.",
    useCase: "A rejected or partially-applied transaction is worse than a cleanly failed one — operational and compliance systems need a transaction to either fully happen or fully not happen, with nothing in between to reconcile.",
    mechanism: "Advance, Passthrough, and the payload instructions land as one atomic Solana transaction. If any inner CPI fails, the entire transaction fails — the nonce does not advance and no partial state change occurs.",
    fit: "full",
    fitNote: "Atomicity is inherited directly from Solana transaction semantics, not something Vector has to add.",
    scriptFile: "08-state-change-tolerance.ts",
    testFile: "state_change_tolerance.rs",
  },
  {
    number: 9,
    slug: "composability",
    title: "Composability",
    spec: "Must work with existing DeFi applications, wallet infrastructure, and other standard tooling, or have a clear upgrade path. Ideally includes integration with the wallet standard.",
    useCase: "Token administration authority-change operations, staking rebalances, and DeFi interactions all need the replacement mechanism to actually be able to drive arbitrary existing programs, not just move lamports.",
    mechanism: "Passthrough CPIs into arbitrary programs via invoke_signed, temporarily promoting the Vector PDA to signer. Vector's own tests demonstrate an SPL mint-authority round trip this way — the PDA takes mint authority, acts, then hands it back.",
    fit: "partial",
    fitNote: "CPI composability with existing on-chain programs works today. Wallet-standard integration doesn't appear to exist yet — a real gap, not glossed over here.",
    scriptFile: "09-composability.ts",
    testFile: "composability_spl.rs",
  },
];

export function getRequirement(slug: string): Requirement | undefined {
  return requirements.find((r) => r.slug === slug);
}
