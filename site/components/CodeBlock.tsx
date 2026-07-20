export function CodeBlock({ title, children }: { title?: string; children: string }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
      {title && (
        <div className="border-b border-neutral-200 bg-neutral-50 px-4 py-2 font-mono text-xs text-neutral-500 dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-400">
          {title}
        </div>
      )}
      <pre className="overflow-x-auto bg-neutral-950 p-4 text-sm text-neutral-100">
        <code>{children}</code>
      </pre>
    </div>
  );
}
