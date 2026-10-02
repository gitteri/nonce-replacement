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

type RequirementSpec = Pick<Requirement, "number" | "slug" | "title" | "spec" | "useCase" | "scriptFile">;
type SolutionFit = Pick<Requirement, "mechanism" | "fit" | "fitNote" | "testFile">;

const specs: RequirementSpec[] = [
  {
    number: 1,
    slug: "time-window",
    title: "Sign-to-Broadcast Time Window",
    spec: "Must support an extended sign-to-broadcast time window beyond what blockhashes provide today. An infinite window is not required: a cap of a day or two is acceptable.",
    useCase: "Cold wallet signing ceremonies run 5 minutes to 2 days, depending on approver count and ceremony complexity. A blockhash's 60-90 second expiry makes it useless for this: re-signing means restarting the ceremony, not retrying a broadcast.",
    scriptFile: "01-time-window.ts",
  },
  {
    number: 2,
    slug: "concurrency",
    title: "Concurrency",
    spec: "A single signing authority should be able to sign multiple pre-signed transactions to be broadcast simultaneously. Batching is standard practice: cold wallet ceremonies, staking rebalances, treasury operations, and deferred settlement all produce multiple transactions per session.",
    useCase: "A validator rebalancing ceremony can produce 10-30 transactions with ordering dependencies. A desk running OTC/RFQ flows may hold 5-20 open positions simultaneously, each needing its own pre-signed settlement.",
    scriptFile: "02-concurrency.ts",
  },
  {
    number: 3,
    slug: "fee-payer-separation",
    title: "Fee-Payer Separation",
    spec: "Signing authority and fee-payer can be different keys. Fee-payer selection at broadcast time, rather than sign time, is a nice-to-have. Many institutional cold wallets hold zero SOL for compliance and accounting reasons.",
    useCase: "Fee-payer infrastructure is typically shared across many signing authorities. The specific payer is chosen at broadcast time based on balance and availability, information the cold wallet does not have when it signs.",
    scriptFile: "03-fee-payer-separation.ts",
  },
  {
    number: 4,
    slug: "transaction-integrity",
    title: "Transaction Integrity",
    spec: "The signed payload must not be alterable by the fee-payer or any other party between signing and broadcast. Signatures must be scoped to the action they sign for, not applicable to other or additional instructions added at broadcast time.",
    useCase: "The signing authority's intent, destination, amount, program invocation, and parameters, must be cryptographically locked at sign time. A monotonic-counter durable nonce does not provide this: nothing stops a future transaction from being substituted for the one originally signed.",
    scriptFile: "04-transaction-integrity.ts",
  },
  {
    number: 5,
    slug: "selective-revocation",
    title: "Selective Revocation",
    spec: "Must be possible to revoke a specific pre-signed transaction without affecting any other outstanding transaction from the same authority. Revocation must be unilateral, with no counterparty cooperation required, and final.",
    useCase: "OTC/RFQ settlement is the sharpest version of this: a pre-signed transaction sits with a counterparty, outside the signer's own infrastructure. The signing authority needs to invalidate something someone else holds and is incentivized to broadcast.",
    scriptFile: "05-selective-revocation.ts",
  },
  {
    number: 6,
    slug: "no-onchain-footprint",
    title: "No Onchain Footprint at Sign Time",
    spec: "An extended sign-to-broadcast window must not rely on onchain state updates such as buffer accounts. Any mechanism that touches chain state at sign time signals intent to observers.",
    useCase: "Non-negotiable for trading and settlement: a policy engine or DeFi counterparty watching the chain must not be able to detect that a signing ceremony has started before the transaction broadcasts.",
    scriptFile: "06-no-onchain-footprint.ts",
  },
  {
    number: 7,
    slug: "parsability",
    title: "Transaction Parsability",
    spec: "The core transaction payload must be inspectable by external systems, often offline. Structural additions the mechanism introduces must be cleanly separable from the user's intended instructions.",
    useCase: "Policy engines validate payloads against user intent, and operational systems check validity between signing and broadcast, frequently inside offline cold-wallet infrastructure that cannot call out to a live parser.",
    scriptFile: "07-parsability.ts",
  },
  {
    number: 8,
    slug: "state-change-tolerance",
    title: "State Change Tolerance",
    spec: "No silent partial execution or unexpected behavior. Systems must be able to check validity offchain before submitting to the network.",
    useCase: "A rejected or partially-applied transaction is worse than a cleanly failed one. Operational and compliance systems need a transaction to either fully happen or fully not happen, with nothing in between to reconcile.",
    scriptFile: "08-state-change-tolerance.ts",
  },
  {
    number: 9,
    slug: "composability",
    title: "Composability",
    spec: "Must work with existing DeFi applications, wallet infrastructure, and other standard tooling, or have a clear upgrade path. Ideally includes integration with the wallet standard.",
    useCase: "Token administration authority-change operations, staking rebalances, and DeFi interactions all need the replacement mechanism to drive arbitrary existing programs, beyond moving lamports.",
    scriptFile: "09-composability.ts",
  },
];

function withFits(fits: Record<string, SolutionFit>): Requirement[] {
  return specs.map((s) => ({ ...s, ...fits[s.slug] }));
}

export const vectorRequirements = withFits({
  "time-window": {
    mechanism: "A Vector nonce is a hashchain value with no built-in expiry: a signature stays valid until something advances the chain. A timeout or expiry check instruction can be layered on top when a hard cap is wanted.",
    fit: "full",
    fitNote: "No expiry by default. Capping is opt-in rather than a built-in constraint.",
    testFile: "no_onchain_footprint.rs",
  },
  concurrency: {
    mechanism: "One VectorAccount, tied to one identity, allows exactly one outstanding pre-signed transaction at a time: signatures against the same nonce are mutually exclusive. Concurrency comes from running a pool of N identities, one per lane, the same pattern custodians already use with pools of durable-nonce accounts.",
    fit: "partial",
    fitNote: "Concurrency is lane-based rather than unlimited per signer, the same operating model custodians already run with durable-nonce pools.",
    testFile: "concurrency_lanes.rs",
  },
  "fee-payer-separation": {
    mechanism: "The signed digest hashes only the pre/advance/post instructions' own account metadata, in the instructions-sysvar wire format. There is no implicit fee-payer field. The fee payer enters the hash only if its pubkey is deliberately referenced inside a signed instruction; otherwise it is free to be chosen at broadcast time.",
    fit: "full",
    fitNote: "Verified directly against Vector's digest.rs: the digest is fee-payer-independent by construction.",
    testFile: "fee_payer_separation.rs",
  },
  "transaction-integrity": {
    mechanism: "The digest is a SHA-256 hash of the exact instruction buffer, minus the 64-byte signature carve-out, at sign time. Any byte changed, or any instruction appended, produces a different hash and fails on-chain verification.",
    fit: "full",
    fitNote: "This is the core property the hashchain design exists to guarantee.",
    testFile: "transaction_integrity.rs",
  },
  "selective-revocation": {
    mechanism: "sign_revocation_instruction_ed25519 produces an inert Advance, with no pre or post instructions, signed at the currently outstanding nonce. Landing it advances the nonce with zero side effects, permanently orphaning that lane's one outstanding transaction. Other lanes, other identities, are untouched.",
    fit: "full",
    fitNote: "Full fit at the lane level: revoking one lane never touches another lane's outstanding transaction.",
    testFile: "selective_revocation.rs",
  },
  "no-onchain-footprint": {
    mechanism: "Signing happens entirely offline against a nonce value fetched ahead of time: no RPC calls and no writes at sign time. The only on-chain footprint is the eventual Advance or Passthrough transaction itself, landed whenever the signer chooses to broadcast it.",
    fit: "full",
    fitNote: "Signing is a pure offline computation. Nothing touches the network until broadcast.",
    testFile: "no_onchain_footprint.rs",
  },
  parsability: {
    mechanism: "Passthrough cleanly separates the Advance housekeeping instruction from the user's actual payload instructions. The payload instructions themselves are standard, unwrapped Solana instructions, parsed by a policy engine exactly like any other transaction.",
    fit: "full",
    fitNote: "The wrapper, Advance and Passthrough, and the payload are structurally distinct, not interleaved.",
    testFile: "parsability.rs",
  },
  "state-change-tolerance": {
    mechanism: "Advance, Passthrough, and the payload instructions land as one atomic Solana transaction. If any inner CPI fails, the entire transaction fails: the nonce does not advance and no partial state change occurs.",
    fit: "full",
    fitNote: "Atomicity comes directly from Solana transaction semantics, inherited rather than added by Vector.",
    testFile: "state_change_tolerance.rs",
  },
  composability: {
    mechanism: "Passthrough CPIs into arbitrary programs via invoke_signed, temporarily promoting the Vector PDA to signer. Vector's own tests demonstrate an SPL mint-authority round trip this way: the PDA takes mint authority, acts, then hands it back.",
    fit: "partial",
    fitNote: "CPI composability with existing on-chain programs works today. Wallet-standard integration does not appear to exist yet, a real gap.",
    testFile: "composability_spl.rs",
  },
});

export const programmaticSignerRequirements = withFits({
  "time-window": {
    mechanism: "Neither the Signer nor the Executor checks a clock or slot. A signed Submit stays valid until its nonce account advances, however long the ceremony takes. A hard cap means adding an expiry check instruction inside the signed payload.",
    fit: "full",
    fitNote: "No expiry by default. A cap has to be built into the signed payload.",
    testFile: "time_window.rs",
  },
  concurrency: {
    mechanism: "One cold key controls any number of nonce accounts, all spending from the same PDA, with one outstanding transaction per nonce account. Ordered batches can also be pre-signed as a chain on a single account: successor nonces are computable offline, so transaction N+1 only becomes valid once N lands.",
    fit: "full",
    fitNote: "Many nonce accounts per cold key, all acting for one PDA. Vector needs a separate identity per lane.",
    testFile: "concurrency_nonce_accounts.rs",
  },
  "fee-payer-separation": {
    mechanism: "Submit takes no signature from the cold key's side at broadcast. The relayer signs the outer transaction and pays the fee, and its key is not part of the signed bytes unless the payload deliberately references it.",
    fit: "full",
    fitNote: "Any relayer can land a signed Submit. The fee payer is chosen at broadcast time.",
    testFile: "fee_payer_separation.rs",
  },
  "transaction-integrity": {
    mechanism: "The cold key signs the full serialized authorization message, which embeds the execution message with every payload instruction, account and privilege. Changing one byte fails the Signer's Ed25519 check. A relayer can add its own top-level instructions around Submit, but those never get the PDA's signer privilege.",
    fit: "full",
    fitNote: "The signature covers the whole payload. Relayer additions run without the PDA's authority.",
    testFile: "transaction_integrity.rs",
  },
  "selective-revocation": {
    mechanism: "Sign an Execute with an empty payload at the outstanding nonce and land it. The nonce account advances with a different commitment, which orphans the transaction signed against it and every later link in that chain. Other nonce accounts are untouched.",
    fit: "full",
    fitNote: "Full fit per nonce account: revoking one never touches another account's outstanding transaction.",
    testFile: "selective_revocation.rs",
  },
  "no-onchain-footprint": {
    mechanism: "Signing is an offline computation over the stored nonce, which is predictable once the nonce account exists. Nothing touches chain state until a relayer lands Submit. Nonce accounts are created ahead of time and carry nothing about what will later be signed against them.",
    fit: "full",
    fitNote: "No RPC calls or writes at sign time. Nonce accounts are set up once, before any ceremony.",
    testFile: "no_onchain_footprint.rs",
  },
  parsability: {
    mechanism: "The payload is a standard v1 Solana message inside the Execute instruction, which is itself inside the signed authorization message carried in Submit's data. A policy engine decodes two message layers before it reaches the user's instructions. Upstream's CLI ships transaction decode for this.",
    fit: "partial",
    fitNote: "Standard message format, wrapped two layers deep. Parsers need to know the envelope.",
    testFile: "parsability.rs",
  },
  "state-change-tolerance": {
    mechanism: "Submit, Execute, the nonce advance and every payload CPI run inside one Solana transaction. Any failure reverts all of it, including the advance, so the same signed Submit can still be retried or revoked.",
    fit: "full",
    fitNote: "Atomicity comes from Solana transaction semantics. The Executor advances the nonce inside the same transaction.",
    testFile: "state_change_tolerance.rs",
  },
  composability: {
    mechanism: "The Executor CPIs arbitrary programs with the PDA as signer, so the PDA can own token accounts or hold an authority and act on it. Payload programs run two CPI levels below Submit, which leaves less nesting budget for programs that CPI further.",
    fit: "partial",
    fitNote: "CPI into existing programs works today. The Kit-based JS client is not on npm yet and there is no wallet-standard integration.",
    testFile: "composability_spl.rs",
  },
});
