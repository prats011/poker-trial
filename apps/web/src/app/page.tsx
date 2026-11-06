"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Card } from "@poker/ui";

export default function Home() {
  const [invite, setInvite] = useState("");
  const joinPath = invite.trim().replace(/^https?:\/\/[^/]+/, "") || "/game/";
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col justify-center gap-6 px-6">
      <Badge>Phase 1 Foundation</Badge>
      <Card className="space-y-4">
        <h1 className="text-3xl font-semibold">Poker Trial</h1>
        <p className="text-sm text-[#8b949e]">Create a private lobby, invite friends, choose seats, and get ready to play.</p>
        <div className="flex gap-3 text-sm">
          <Link href="/create" className="rounded-md border border-[#30363d] bg-[#2f81f7] px-4 py-2 text-white hover:opacity-90">
            Create Table
          </Link>
          <div className="flex flex-1 gap-2">
            <input aria-label="Invitation link" value={invite} onChange={(event) => setInvite(event.target.value)} placeholder="Paste an invite link" className="min-w-0 flex-1 rounded-md border border-[#30363d] bg-[#0f1115] px-3 py-2 text-sm" />
            <Link href={joinPath} className="rounded-md border border-[#30363d] bg-[#238636] px-4 py-2 text-white hover:opacity-90">Join</Link>
          </div>
        </div>
      </Card>
    </main>
  );
}
