import Link from "next/link";
import { requirements } from "@/content/requirements";
import { RequirementCard } from "@/components/RequirementCard";

export default function VectorOverviewPage() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/" className="text-sm text-neutral-500 hover:underline">
        &larr; Back
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight">Vector</h1>
      <p className="mt-4 max-w-2xl text-neutral-600 dark:text-neutral-400">
        Vector replaces a durable nonce&apos;s monotonic counter with a hashchain: each signed
        transaction&apos;s digest becomes the account&apos;s next valid nonce. A transaction is
        built offline, its signature region is swapped for the stored nonce + identity, the whole
        instruction buffer is hashed, and that digest &mdash; not the transaction itself &mdash;
        is what gets signed. Nothing can be substituted after the fact without breaking the chain.
      </p>
      <p className="mt-3 max-w-2xl text-neutral-600 dark:text-neutral-400">
        One <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">VectorAccount</code> per
        identity holds the current nonce; landing an <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">Advance</code>{" "}
        verifies the offchain signature and installs the next nonce, optionally passing control to
        a sibling <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">Passthrough</code>{" "}
        instruction that CPIs into arbitrary programs with the PDA promoted to signer.
      </p>

      <h2 className="mt-10 text-lg font-medium">Requirements</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {requirements.map((r) => (
          <RequirementCard key={r.slug} requirement={r} />
        ))}
      </div>
    </main>
  );
}
