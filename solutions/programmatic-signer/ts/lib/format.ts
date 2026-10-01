import { explorerLink } from "./explorer.js";

export function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

export function logTx(label: string, signature: string): void {
  console.log(`${label}: ${signature}`);
  console.log(`  ${explorerLink(signature)}`);
}

type RpcError = Error & { cause?: Error; context?: { logs?: string[] | null } };

/** The simulation's cause and the innermost failing program log line, when the RPC returned them. */
export function firstLine(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const { cause, context } = err as RpcError;
  const failure = context?.logs?.find((line) => / failed|Error/.test(line));
  return [cause?.message ?? err.message.split("\n")[0], failure].filter(Boolean).join(" | ");
}
