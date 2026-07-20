import Link from "next/link";
import { RequirementNav } from "@/components/RequirementNav";
import { WalletConnectButton } from "@/components/WalletConnectButton";

export default function VectorLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-6xl gap-8 px-6 py-8">
      <aside className="sticky top-8 hidden h-fit w-64 shrink-0 lg:block">
        <Link href="/" className="text-sm font-medium">
          Nonce Replacement
        </Link>
        <div className="mt-2 text-xs text-neutral-500">Vector</div>
        <div className="mt-4">
          <WalletConnectButton />
        </div>
        <div className="mt-6">
          <RequirementNav />
        </div>
      </aside>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
