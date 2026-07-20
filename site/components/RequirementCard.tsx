import Link from "next/link";
import type { Requirement } from "@/content/requirements";
import { FitBadge } from "./FitBadge";

export function RequirementCard({ requirement }: { requirement: Requirement }) {
  return (
    <Link
      href={`/vector/${requirement.slug}`}
      className="block rounded-lg border border-neutral-200 p-4 transition-colors hover:border-neutral-400 dark:border-neutral-800 dark:hover:border-neutral-600"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xs tabular-nums text-neutral-500">Requirement {requirement.number}</div>
          <div className="mt-1 font-medium">{requirement.title}</div>
        </div>
        <FitBadge fit={requirement.fit} />
      </div>
      <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">{requirement.fitNote}</p>
    </Link>
  );
}
