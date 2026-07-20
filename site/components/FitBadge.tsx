import type { Fit } from "@/content/requirements";

export function FitBadge({ fit }: { fit: Fit }) {
  const isFull = fit === "full";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isFull
          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      }`}
    >
      {isFull ? "Full fit" : "Partial fit"}
    </span>
  );
}
