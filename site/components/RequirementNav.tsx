import Link from "next/link";
import { requirements } from "@/content/requirements";
import { FitBadge } from "./FitBadge";

export function RequirementNav({ activeSlug }: { activeSlug?: string }) {
  return (
    <nav className="space-y-1">
      {requirements.map((r) => (
        <Link
          key={r.slug}
          href={`/vector/${r.slug}`}
          className={`flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
            r.slug === activeSlug
              ? "bg-neutral-900 text-white dark:bg-white dark:text-neutral-900"
              : "text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-900"
          }`}
        >
          <span>
            <span className="mr-2 tabular-nums opacity-60">{r.number}.</span>
            {r.title}
          </span>
        </Link>
      ))}
    </nav>
  );
}
