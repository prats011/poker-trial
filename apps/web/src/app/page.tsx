import Link from "next/link";
import { Badge, Card } from "@poker/ui";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6">
      <Badge>Phase 1 Foundation</Badge>
      <Card className="space-y-4">
        <h1 className="text-3xl font-semibold">Poker Trial</h1>
        <p className="text-sm text-[#8b949e]">Core shell is live. Game flows are intentionally not implemented in this chunk.</p>
        <div className="flex gap-3 text-sm">
          <Link href="/create" className="rounded-md border border-[#30363d] bg-[#2f81f7] px-4 py-2 text-white hover:opacity-90">
            Create Table
          </Link>
          <Link href="/game/placeholder" className="rounded-md border border-[#30363d] bg-[#238636] px-4 py-2 text-white hover:opacity-90">
            Open Table Route
          </Link>
        </div>
      </Card>
    </main>
  );
}
