import { explorerLink } from "./explorer.js";

export function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

export function logTx(label: string, signature: string): void {
  console.log(`${label}: ${signature}`);
  console.log(`  ${explorerLink(signature)}`);
}
