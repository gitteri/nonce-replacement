"use client";

import { useCallback, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  createInitializeEd25519Devnet,
  explorerAccountLink,
  explorerLink,
  fetchVectorAccountV1,
  generateIdentity,
  hex,
  sendV1,
  signAdvanceEd25519Devnet,
  toV1Instruction,
  toV3Address,
  vectorPdaV1,
} from "@/lib/vector";

interface Step {
  label: string;
  detail: string;
  link?: string;
}

type Status = "idle" | "running" | "done" | "error";

export function TimeWindowDemo() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const [status, setStatus] = useState<Status>("idle");
  const [steps, setSteps] = useState<Step[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    if (!wallet.publicKey) return;
    setStatus("running");
    setSteps([]);
    setError(null);

    try {
      const feePayer = toV3Address(wallet.publicKey);
      const { signingKey, identity } = generateIdentity();
      const pda = vectorPdaV1(identity);

      const initIx = toV1Instruction(createInitializeEd25519Devnet(feePayer, identity));
      const initSig = await sendV1(connection, wallet, [initIx]);
      setSteps((s) => [
        ...s,
        {
          label: "Initialized vector account",
          detail: `PDA ${pda.toBase58()}`,
          link: explorerLink(initSig),
        },
      ]);

      const before = await fetchVectorAccountV1(connection, identity);
      setSteps((s) => [
        ...s,
        { label: "Fetched starting nonce", detail: hex(before.nonce) },
      ]);

      const signedAt = new Date();
      const advanceIx = toV1Instruction(
        signAdvanceEd25519Devnet(signingKey, before.nonce, [], [], feePayer)
      );
      setSteps((s) => [
        ...s,
        {
          label: `Signed an advance at ${signedAt.toLocaleTimeString()}`,
          detail:
            "The digest folds in the nonce and instruction bytes only — no blockhash, " +
            "no expiry. These exact bytes would verify identically if broadcast a day from " +
            "now, unlike a regular Solana transaction, which expires in ~60-90s once its " +
            "blockhash ages out.",
        },
      ]);

      const advanceSig = await sendV1(connection, wallet, [advanceIx]);
      setSteps((s) => [
        ...s,
        { label: "Landed the advance", detail: "", link: explorerLink(advanceSig) },
      ]);

      const after = await fetchVectorAccountV1(connection, identity);
      setSteps((s) => [
        ...s,
        {
          label: "Nonce advanced",
          detail: hex(after.nonce),
          link: explorerAccountLink(pda.toBase58()),
        },
      ]);

      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStatus("error");
    }
  }, [connection, wallet]);

  if (!wallet.publicKey) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
        Connect a wallet (top left) to run this demo live on devnet.
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-200 p-6 dark:border-neutral-800">
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        Runs entirely against devnet using your connected wallet as fee payer. Needs a small
        amount of devnet SOL — grab some from{" "}
        <a
          href="https://faucet.solana.com"
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          faucet.solana.com
        </a>{" "}
        if the run fails on insufficient balance.
      </p>

      <button
        type="button"
        onClick={run}
        disabled={status === "running"}
        className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
      >
        {status === "running" ? "Running…" : "Run demo"}
      </button>

      {steps.length > 0 && (
        <ol className="mt-4 space-y-3">
          {steps.map((step, i) => (
            <li key={i} className="text-sm">
              <div className="font-medium text-neutral-800 dark:text-neutral-200">
                {step.label}
              </div>
              {step.detail && (
                <div className="mt-0.5 break-all text-neutral-600 dark:text-neutral-400">
                  {step.detail}
                </div>
              )}
              {step.link && (
                <a
                  href={step.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 inline-block text-neutral-500 underline dark:text-neutral-500"
                >
                  View on explorer
                </a>
              )}
            </li>
          ))}
        </ol>
      )}

      {error && (
        <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
    </div>
  );
}
