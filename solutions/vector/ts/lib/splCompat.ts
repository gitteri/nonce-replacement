/**
 * `@solana/spl-token@0.4` targets web3.js v1's `PublicKey` API; `@solana/web3.js@3`'s
 * `Address` is missing `toBuffer()` and the synchronous `findProgramAddressSync`
 * spl-token expects. Same shim Vector's own SDK test suite installs
 * (`sdk/ts/test/helpers.ts`). Import this module for its side effect before
 * using `@solana/spl-token`.
 */
import { createHash } from "node:crypto";
import { Address } from "@solana/web3.js";
import { ed25519 } from "@noble/curves/ed25519.js";

if (!(Address.prototype as any).toBuffer) {
  (Address.prototype as any).toBuffer = function (this: Address) {
    return Buffer.from(this.toBytes());
  };
}

if (!(Address as any).findProgramAddressSync) {
  const PDA_MARKER = new TextEncoder().encode("ProgramDerivedAddress");
  const sha256 = (data: Uint8Array): Uint8Array =>
    new Uint8Array(createHash("sha256").update(data).digest());
  const isOnCurve = (point: Uint8Array): boolean => {
    try {
      (ed25519 as any).Point.fromBytes(point);
      return true;
    } catch {
      return false;
    }
  };
  (Address as any).findProgramAddressSync = (
    seeds: Uint8Array[],
    programId: Address
  ): [Address, number] => {
    const programBytes = programId.toBytes();
    const totalLen =
      seeds.reduce((n, s) => n + s.length, 0) + 1 + programBytes.length + PDA_MARKER.length;
    const buf = new Uint8Array(totalLen);
    let off = 0;
    for (const s of seeds) {
      buf.set(s, off);
      off += s.length;
    }
    const bumpOff = off++;
    buf.set(programBytes, off);
    off += programBytes.length;
    buf.set(PDA_MARKER, off);
    for (let bump = 255; bump >= 0; bump--) {
      buf[bumpOff] = bump;
      const hash = sha256(buf);
      if (!isOnCurve(hash)) {
        return [new Address(hash), bump];
      }
    }
    throw new Error("Unable to find a viable PDA bump seed");
  };
}
