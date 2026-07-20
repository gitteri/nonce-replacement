import { notFound } from "next/navigation";
import { getRequirement, requirements } from "@/content/requirements";
import { FitBadge } from "@/components/FitBadge";
import { CodeBlock } from "@/components/CodeBlock";

export function generateStaticParams() {
  return requirements.map((r) => ({ requirement: r.slug }));
}

export default function RequirementPage({ params }: { params: { requirement: string } }) {
  const requirement = getRequirement(params.requirement);
  if (!requirement) notFound();

  return (
    <main className="max-w-2xl pb-24">
      <div className="flex items-center gap-3">
        <span className="text-sm tabular-nums text-neutral-500">
          Requirement {requirement.number} / {requirements.length}
        </span>
        <FitBadge fit={requirement.fit} />
      </div>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{requirement.title}</h1>

      <section className="mt-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Spec</h2>
        <p className="mt-2 text-neutral-800 dark:text-neutral-200">{requirement.spec}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Why it matters
        </h2>
        <p className="mt-2 text-neutral-800 dark:text-neutral-200">{requirement.useCase}</p>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          How Vector satisfies it
        </h2>
        <p className="mt-2 text-neutral-800 dark:text-neutral-200">{requirement.mechanism}</p>
        <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{requirement.fitNote}</p>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">
          Live demo
        </h2>
        <div className="mt-2 rounded-lg border border-dashed border-neutral-300 p-6 text-sm text-neutral-500 dark:border-neutral-700">
          Live devnet demo coming soon &mdash; see{" "}
          <code className="rounded bg-neutral-100 px-1 py-0.5 dark:bg-neutral-900">
            solutions/vector/ts/scripts/{requirement.scriptFile}
          </code>{" "}
          for the runnable version of this demo today.
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-500">Code</h2>
        <div className="mt-2 space-y-3">
          <CodeBlock title={`solutions/vector/ts/scripts/${requirement.scriptFile}`}>
            {`pnpm --filter @nonce-replacement/vector-ts exec tsx scripts/${requirement.scriptFile}`}
          </CodeBlock>
          <CodeBlock title={`solutions/vector/rust/tests/${requirement.testFile}`}>
            {`cargo test --package vector-tests --test ${requirement.testFile.replace(/\\.rs$/, "")}`}
          </CodeBlock>
        </div>
      </section>
    </main>
  );
}
