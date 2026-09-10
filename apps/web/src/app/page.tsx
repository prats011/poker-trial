import Link from "next/link";
import { Badge, Button, Card } from "@poker/ui";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6">
      <Badge>Phase 1 Foundation</Badge>
      <Card className="space-y-4">
        <h1 className="text-3xl font-semibold">Poker Trial</h1>
        <p className="text-sm text-[#8b949e]">Core shell is live. Game flows are intentionally not implemented in this chunk.</p>
        <div className="flex gap-3">
          <Button asChild={false}><Link href="/create">Create Table</Link></Button>
          <Button asChild={false} className="bg-[#238636]"><Link href="/game/placeholder">Open Table Route</Link></Button>
        </div>
      </Card>
    </main>
  );
}
