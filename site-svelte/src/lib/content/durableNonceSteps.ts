import type { Step } from "$lib/components/StepThrough.svelte";

export const durableNonceSteps: Step[] = [
  {
    phase: "mechanism",
    title: "A durable nonce is a placeholder, nothing more",
    body: "It sits between the signing authority and whatever it authorizes: a predictable value anyone watching the chain can already see.",
    boxes: [
      { label: "Signing authority", variant: "neutral" },
      { label: "Durable nonce account", detail: "predictable, shared counter", variant: "neutral" },
      { label: "Funds & authorities", variant: "neutral" },
    ],
  },
  {
    phase: "mechanism",
    title: "The same nonce can back two different transactions",
    body: "The nonce doesn't bind to what it's paired with beyond the signature itself. Sign two different transactions against it and both are valid. Whichever lands first wins.",
    boxes: [
      { label: "Durable nonce account", variant: "neutral" },
      { label: "Transaction A", variant: "warning" },
      { label: "Transaction B", variant: "warning" },
    ],
    note: "The substitution risk.",
  },
];
