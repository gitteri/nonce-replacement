// A Vector "identity" is just an Ed25519 keypair — the offline signer whose
// pre-signed transactions get broadcast later. In the CLI scripts this is generated
// fresh per run (`ed25519.utils.randomSecretKey()`); the browser does the same thing
// per demo run. This is realistic, not a shortcut: a real custodian's signing key
// never touches a browser either, and generating a throwaway identity is exactly
// what the demo needs to show the mechanism.
import { ed25519 } from "@noble/curves/ed25519.js";

export interface VectorIdentity {
  signingKey: Uint8Array;
  identity: Uint8Array;
}

export function generateIdentity(): VectorIdentity {
  const signingKey = ed25519.utils.randomSecretKey();
  const identity = ed25519.getPublicKey(signingKey);
  return { signingKey, identity };
}
