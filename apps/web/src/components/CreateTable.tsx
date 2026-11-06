"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge, Button, Card, Input } from "@poker/ui";
import { postJson } from "../lib/api";

type CreatedTable = { inviteToken: string; sessionId: string };

export function CreateTable() {
  const [nickname, setNickname] = useState("");
  const [variant, setVariant] = useState("HOLD_EM_NO_LIMIT");
  const [maxPlayers, setMaxPlayers] = useState("6");
  const [startingStack, setStartingStack] = useState("1000");
  const [smallBlind, setSmallBlind] = useState("5");
  const [bigBlind, setBigBlind] = useState("10");
  const [turnTimerSeconds, setTurnTimerSeconds] = useState("30");
  const [result, setResult] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      const data = await postJson<CreatedTable>("/api/games", {
        nickname: nickname.trim(),
        configuration: {
          variant,
          maxPlayers: Number(maxPlayers),
          startingStack: Number(startingStack),
          smallBlind: Number(smallBlind),
          bigBlind: Number(bigBlind),
          turnTimerSeconds: Number(turnTimerSeconds)
        }
      });
      const url = `${window.location.origin}/game/${data.inviteToken}`;
      setResult(url);
      localStorage.setItem("poker:lastInviteUrl", url);
      localStorage.setItem(`poker:session:${data.inviteToken}`, data.sessionId);
      localStorage.setItem("poker:nickname", nickname.trim());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to create a table.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="w-full max-w-xl space-y-6">
      <div>
        <Badge>New table</Badge>
        <h1 className="mt-3 text-3xl font-semibold">Create a poker table</h1>
        <p className="mt-2 text-sm text-[#8b949e]">Set up a lobby, then share the invite with your friends.</p>
      </div>
      <form className="space-y-4" onSubmit={submit}>
        <label className="block space-y-2 text-sm"><span className="font-medium">Your nickname</span><Input required value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="How friends will know you" maxLength={24} /></label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm">
            <span className="font-medium">Game</span>
            <select value={variant} onChange={(event) => setVariant(event.target.value)} className="w-full rounded-md border border-[#30363d] bg-[#0f1115] px-3 py-2 text-sm">
              <option value="HOLD_EM_NO_LIMIT">Texas Hold’em · No Limit</option>
              <option value="OMAHA_HI">4-card Omaha Hi</option>
              <option value="PLO_DOUBLE_BOARD_BOMB_POT">4-card PLO Double Board Bomb Pot</option>
            </select>
          </label>
          <label className="block space-y-2 text-sm">
            <span className="font-medium">Seats</span>
            <select value={maxPlayers} onChange={(event) => setMaxPlayers(event.target.value)} className="w-full rounded-md border border-[#30363d] bg-[#0f1115] px-3 py-2 text-sm">
              <option value="2">2 players</option>
              <option value="6">6 players</option>
              <option value="9">9 players</option>
            </select>
          </label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-2 text-sm"><span>Starting stack</span><Input type="number" min="1" value={startingStack} onChange={(e) => setStartingStack(e.target.value)} /></label>
          <label className="block space-y-2 text-sm"><span>Turn timer (seconds)</span><Input type="number" min="1" value={turnTimerSeconds} onChange={(e) => setTurnTimerSeconds(e.target.value)} /></label>
          <label className="block space-y-2 text-sm"><span>Small blind</span><Input type="number" min="1" value={smallBlind} onChange={(e) => setSmallBlind(e.target.value)} /></label>
          <label className="block space-y-2 text-sm"><span>Big blind</span><Input type="number" min="1" value={bigBlind} onChange={(e) => setBigBlind(e.target.value)} /></label>
        </div>
        {error && <p role="alert" className="rounded-md border border-[#f85149]/40 bg-[#f85149]/10 p-3 text-sm text-[#ffb4ad]">{error}</p>}
        {!result ? <Button type="submit" disabled={busy}>{busy ? "Creating…" : "Create table"}</Button> : (
          <div className="space-y-3 rounded-lg border border-[#238636]/50 bg-[#238636]/10 p-4">
            <p className="text-sm font-medium text-[#7ee787]">Your table is ready.</p>
            <p className="break-all text-sm text-[#c9d1d9]">{result}</p>
            <div className="flex flex-wrap gap-3">
              <Link href={result.replace(window.location.origin, "")} className="rounded-md border border-[#30363d] bg-[#238636] px-4 py-2 text-sm font-medium">Open lobby</Link>
              <Button type="button" className="bg-[#30363d]" onClick={() => navigator.clipboard?.writeText(result)}>Copy invite link</Button>
            </div>
          </div>
        )}
      </form>
    </Card>
  );
}
