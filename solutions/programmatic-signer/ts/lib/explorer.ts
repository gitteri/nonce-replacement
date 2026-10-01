export function explorerLink(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function explorerAccountLink(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}
