"use client";

import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { Badge, Button, Card, Input } from "@poker/ui";
import type { PokerStateView, TableState } from "@poker/protocol";
import { API_URL, copyText, postJson } from "../lib/api";

type Props = { inviteToken: string };
type Seat = TableState["seats"][number];
type ChatMessage = { nickname: string; message: string };
type JoinResponse = { sessionId: string; tableState: TableState };
type Configuration = TableState["configuration"];

const NICKNAME_KEY = "poker:nickname";

function PokerTable({ state, sessionId, emit }: { state: PokerStateView; sessionId: string; emit: (event: string, payload: unknown) => void }) {
  const [amount, setAmount] = useState("");
  const me = state.players.find((player) => player.playerId === sessionId);
  const act = (type: PokerStateView["legalActions"][number]["type"], suggested?: number) => {
    const value = suggested ?? (amount ? Number(amount) : undefined);
    emit("POKER_ACTION", { type, ...(value === undefined ? {} : { amount: value }), stateVersion: state.stateVersion });
    setAmount("");
  };
  return <Card className="mb-5 space-y-4 border-[#238636]/50">
    <div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Hand · {state.street}</h2><Badge>{state.status}</Badge></div>
    <div className="flex flex-wrap gap-3">{state.boards.map((board, index) => <div key={index} className="flex flex-wrap items-center gap-2"><span className="text-xs text-[#8b949e]">Board {index + 1}</span>{board.map((card) => <span key={card} className="poker-deal-card rounded border border-[#30363d] bg-white px-2 py-1 text-sm font-medium text-black">{card}</span>)}</div>)}</div>
    <div className="grid gap-2 sm:grid-cols-2">{state.players.map((player) => <div key={player.playerId} className={`rounded border p-3 ${player.playerId === state.currentPlayerId ? "border-[#2f81f7] bg-[#2f81f7]/10" : "border-[#30363d]"}`}><div className="flex justify-between"><span>{player.nickname}{player.playerId === sessionId ? " (you)" : ""}{player.playerId === state.currentPlayerId ? " · Your turn" : ""}</span><span className="font-semibold">{player.stack}</span></div><div className="mt-1 text-xs text-[#8b949e]">{player.folded ? "Folded" : player.allIn ? "All-in" : `Contribution ${player.handContribution}`}</div>{player.holeCards.length > 0 && <div className="mt-2 flex gap-1">{player.holeCards.map((card) => <span key={card} className="poker-deal-card rounded bg-white px-1 text-xs text-black">{card}</span>)}</div>}</div>)}</div>
    {me && state.currentPlayerId === sessionId && state.legalActions.length > 0 && <div className="flex flex-wrap items-end gap-2 border-t border-[#30363d] pt-3"><Input className="w-28" type="number" min={0} value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="Amount" />{state.legalActions.map((action) => <Button key={action.type} type="button" className="px-3" onClick={() => act(action.type, action.amount)}>{action.type.replace("_", " ")}</Button>)}</div>}
    {state.payouts && <div className="text-sm text-[#8b949e]">Payout complete · {state.payouts.map((payout, index) => <span key={index} className="mr-3">{payout.winners.join(", ")} won {Object.values(payout.amountByPlayer).reduce((sum, value) => sum + value, 0)}</span>)}</div>}
  </Card>;
}

export function Lobby({ inviteToken }: Props) {
  const [nickname, setNickname] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem(NICKNAME_KEY) ?? "");
  const [joined, setJoined] = useState(false);
  const [state, setState] = useState<TableState>();
  const [pokerState, setPokerState] = useState<PokerStateView>();
  const [error, setError] = useState<string>();
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [starting, setStarting] = useState(false);
  const [settings, setSettings] = useState<Configuration>();
  const [joining, setJoining] = useState(false);
  const [rebuyOffer, setRebuyOffer] = useState<{ expiresAt: string; remainingSeconds: number }>();
  const [rebuyAmount, setRebuyAmount] = useState("");
  const [remainingRebuySeconds, setRemainingRebuySeconds] = useState<number>();
  const [activity, setActivity] = useState<string[]>([]);
  const socketRef = useRef<Socket | undefined>(undefined);
  const latestVersion = useRef(-1);
  const autoJoinAttempted = useRef(false);
  const [sessionId, setSessionId] = useState(() => typeof window === "undefined" ? "" : localStorage.getItem(`poker:session:${inviteToken}`) ?? "");

  function applySnapshot(next: TableState) {
    if (next.stateVersion < latestVersion.current) return;
    latestVersion.current = next.stateVersion;
    setState(next);
    setSettings(next.configuration);
  }
  function applyVersion(version: number, update: (current: TableState) => TableState) {
    if (version < latestVersion.current) return;
    latestVersion.current = version;
    setState((current) => current ? update(current) : current);
  }

  useEffect(() => {
    if (autoJoinAttempted.current || joined || !sessionId || !nickname.trim()) return;
    autoJoinAttempted.current = true;
    setJoining(true);
    postJson<JoinResponse>(`/api/games/${encodeURIComponent(inviteToken)}/join`, {
      nickname: nickname.trim(),
      sessionId
    }).then((result) => {
      applySnapshot(result.tableState);
      setSessionId(result.sessionId);
      setJoined(true);
    }).catch(() => {
      localStorage.removeItem(`poker:session:${inviteToken}`);
      setSessionId("");
    }).finally(() => setJoining(false));
  }, [inviteToken, joined, nickname, sessionId]);

  useEffect(() => {
    if (!joined) return;
    const socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? API_URL, { transports: ["websocket"] });
    socketRef.current = socket;
    socket.on("connect", () => {
      socket.emit("JOIN_TABLE", { inviteToken, nickname: nickname.trim(), sessionId });
      setError(undefined);
    });
    socket.on("TABLE_STATE_SNAPSHOT", ({ tableState }: { tableState: TableState }) => applySnapshot(tableState));
    socket.on("POKER_STATE_SNAPSHOT", ({ pokerState: next }: { pokerState: PokerStateView }) => setPokerState(next));
    socket.on("SEAT_UPDATED", ({ seats, stateVersion }: { seats: Seat[]; stateVersion: number }) => applyVersion(stateVersion, (current) => ({ ...current, seats, stateVersion })));
    socket.on("GAME_SETTINGS_UPDATED", ({ configuration, stateVersion }: { configuration: Configuration; stateVersion: number }) => {
      setSettings(configuration);
      applyVersion(stateVersion, (current) => ({ ...current, configuration, stateVersion }));
    });
    socket.on("GAME_STATUS_UPDATED", ({ status, stateVersion }: { status: TableState["status"]; stateVersion: number }) => applyVersion(stateVersion, (current) => ({ ...current, status, stateVersion })));
    socket.on("GAME_LIFECYCLE_UPDATED", ({ status, stateVersion }: { status: TableState["status"]; stateVersion: number }) => applyVersion(stateVersion, (current) => ({ ...current, status, stateVersion })));
    socket.on("REBUY_STATUS_UPDATED", ({ sessionId: eligibleSessionId, eligible, expiresAt, remainingSeconds }: { sessionId: string; eligible: boolean; expiresAt: string | null; remainingSeconds: number | null }) => {
      if (eligibleSessionId !== sessionId) return;
      if (eligible && expiresAt && remainingSeconds !== null) {
        setRebuyOffer({ expiresAt, remainingSeconds });
        setRemainingRebuySeconds(remainingSeconds);
      } else {
        setRebuyOffer(undefined);
        setRemainingRebuySeconds(undefined);
      }
    });
    socket.on("GAME_ENDED", ({ reason }: { reason: string }) => setError(reason));
    socket.on("PLAYER_JOINED", ({ player }: { player?: { nickname: string } }) => player && setActivity((items) => [`${player.nickname} joined the table.`, ...items].slice(0, 6)));
    socket.on("PLAYER_LEFT", ({ sessionId: leftSessionId }: { sessionId: string }) => {
      const left = state?.players.find((player) => player.sessionId === leftSessionId);
      setActivity((items) => [`${left?.nickname ?? "A player"} left the table.`, ...items].slice(0, 6));
    });
    socket.on("PLAYER_PRESENCE", ({ sessionId: presenceSessionId, connectionStatus }: { sessionId: string; connectionStatus: "CONNECTED" | "DISCONNECTED" }) => {
      const player = state?.players.find((item) => item.sessionId === presenceSessionId);
      if (player && connectionStatus === "DISCONNECTED") setActivity((items) => [`${player.nickname} disconnected.`, ...items].slice(0, 6));
    });
    socket.on("CHAT_MESSAGE", ({ senderNickname, message }: { senderNickname: string; message: string }) => setChat((items) => [...items, { nickname: senderNickname, message }]));
    socket.on("ACTION_REJECTED", ({ message: text }: { message?: string }) => setError(text ?? "That action was rejected."));
    socket.on("connect_error", () => setError("The table is unavailable right now. Check the link and try again."));
    socket.on("disconnect", () => setError("Connection lost. Reconnecting…"));
    return () => { socket.disconnect(); socketRef.current = undefined; };
  }, [inviteToken, joined, nickname, sessionId]);

  const previousStatus = useRef<TableState["status"] | undefined>(undefined);
  useEffect(() => {
    if (!state?.status || previousStatus.current === state.status) return;
    if (previousStatus.current === "PAUSE_PENDING" && state.status === "PAUSED") setActivity((items) => ["The table is paused.", ...items].slice(0, 6));
    if (previousStatus.current === "PAUSED" && state.status === "WAITING") setActivity((items) => ["The host resumed the table.", ...items].slice(0, 6));
    if (state.status === "ENDED") setActivity((items) => ["The host ended the game.", ...items].slice(0, 6));
    previousStatus.current = state.status;
  }, [state?.status]);

  useEffect(() => {
    if (!rebuyOffer) return;
    const timer = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((Date.parse(rebuyOffer.expiresAt) - Date.now()) / 1000));
      setRemainingRebuySeconds(next);
      if (next === 0) setRebuyOffer(undefined);
    }, 250);
    return () => window.clearInterval(timer);
  }, [rebuyOffer]);

  function join(event: React.FormEvent) {
    event.preventDefault();
    const value = nickname.trim();
    if (value.length < 1 || value.length > 24) return setError("Choose a nickname between 1 and 24 characters.");
    setError(undefined);
    postJson<JoinResponse>(`/api/games/${encodeURIComponent(inviteToken)}/join`, { nickname: value, sessionId: sessionId || undefined })
      .then((result) => {
        localStorage.setItem(NICKNAME_KEY, value);
        localStorage.setItem(`poker:session:${inviteToken}`, result.sessionId);
        setSessionId(result.sessionId);
        applySnapshot(result.tableState);
        setJoined(true);
      })
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to join this table."));
  }
  function sendChat(event: React.FormEvent) {
    event.preventDefault();
    const value = message.trim();
    if (!value) return;
    socketRef.current?.emit("CHAT_SEND", { message: value });
    setMessage("");
  }
  async function copyInvite() {
    await copyText(`${window.location.origin}/game/${inviteToken}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }
  if (!joined) return <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6"><Card className="w-full space-y-5"><Badge>Private invitation</Badge><div><h1 className="text-3xl font-semibold">Join the table</h1><p className="mt-2 text-sm text-[#8b949e]">Choose the name your friends will see.</p></div><form onSubmit={join} className="space-y-3"><Input autoFocus required value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="Your nickname" maxLength={24} />{error && <p role="alert" className="text-sm text-[#ffb4ad]">{error}</p>}<Button type="submit" disabled={joining} className="w-full justify-center">{joining ? "Restoring session…" : "Join lobby"}</Button></form></Card></main>;
  const mySessionId = sessionId;
  const mySeat = state?.seats.find((seat) => seat.occupiedBySessionId === mySessionId);
  const isHost = state?.hostSessionId === mySessionId;
  const updateSetting = <K extends keyof Configuration>(key: K, value: Configuration[K]) => setSettings((current) => current ? { ...current, [key]: value } : current);
  return <main className="mx-auto min-h-screen w-full max-w-6xl px-6 py-10">
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4"><div><Badge>{state?.status === "PREPARING" ? "Game starting" : state?.status?.replace("_", " ") ?? "Connecting"}</Badge><h1 className="mt-3 text-3xl font-semibold">Poker table</h1><p className="mt-1 text-sm text-[#8b949e]">{state ? `${state.players.filter((player) => player.connectionStatus === "CONNECTED").length} connected · ${state.configuration.variant.replaceAll("_", " ")}` : "Connecting to table…"}</p></div><Button type="button" className="bg-[#30363d]" onClick={copyInvite}>{copied ? "Copied!" : "Copy invite link"}</Button></header>
    {error && <div role="alert" className="mb-5 rounded-lg border border-[#f85149]/40 bg-[#f85149]/10 p-3 text-sm text-[#ffb4ad]">{error}</div>}
    {activity.length > 0 && <Card className="mb-5 border-[#30363d]"><h2 className="text-sm font-semibold">Table activity</h2><div className="mt-2 space-y-1 text-sm text-[#c9d1d9]">{activity.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)}</div></Card>}
    {state?.status === "PAUSE_PENDING" && <div className="mb-5 rounded-lg border border-[#d29922]/40 bg-[#d29922]/10 p-3 text-sm text-[#e3b341]">Pause requested. The current hand will finish before the table pauses.</div>}
    {state?.status === "END_PENDING" && <div className="mb-5 rounded-lg border border-[#d29922]/40 bg-[#d29922]/10 p-3 text-sm text-[#e3b341]">Game ending after the current hand settles.</div>}
    {state?.status === "ENDED" && <div className="mb-5 rounded-lg border border-[#f85149]/40 bg-[#f85149]/10 p-4"><p className="font-medium">Game ended</p><p className="mt-1 text-sm text-[#c9d1d9]">The host ended this table. Final stacks remain visible below.</p></div>}
    {rebuyOffer && <Card className="mb-5 border-[#d29922]/50"><h2 className="font-semibold">Rebuy available</h2><p className="mt-1 text-sm text-[#8b949e]">Choose an amount before the timer expires.</p><p className="mt-2 text-sm font-medium">Time remaining: {remainingRebuySeconds ?? rebuyOffer.remainingSeconds}s</p><div className="mt-3 flex flex-wrap gap-2"><Input aria-label="Rebuy amount" type="number" min={state?.configuration.rebuyMinAmount} max={state?.configuration.rebuyMaxAmount ?? state?.configuration.startingStack} value={rebuyAmount} onChange={(event) => setRebuyAmount(event.target.value)} placeholder={`${state?.configuration.rebuyMinAmount}–${state?.configuration.rebuyMaxAmount ?? state?.configuration.startingStack}`} /><Button type="button" onClick={() => socketRef.current?.emit("REBUY_REQUEST", { amount: Number(rebuyAmount) })}>Confirm rebuy</Button><Button type="button" className="bg-[#30363d]" onClick={() => socketRef.current?.emit("DECLINE_REBUY", {})}>Sit out</Button></div></Card>}
    {pokerState && <PokerTable state={pokerState} sessionId={mySessionId} emit={(event, payload) => socketRef.current?.emit(event, payload)} />}
    <div className="grid gap-5 lg:grid-cols-[1fr_360px]"><Card className="space-y-5"><div className="flex items-center justify-between"><h2 className="text-lg font-semibold">Seats</h2>{mySeat && <Button type="button" className="bg-[#30363d] px-3 py-1.5" onClick={() => socketRef.current?.emit("LEAVE_SEAT", { reason: "left seat" })}>Leave seat</Button>}</div><div className="grid gap-3 sm:grid-cols-2">{(state?.seats ?? []).map((seat) => <button key={seat.seatIndex} onClick={() => !seat.occupiedByNickname && socketRef.current?.emit("REQUEST_SEAT", { seatIndex: seat.seatIndex })} disabled={!!seat.occupiedByNickname} className="rounded-lg border border-[#30363d] bg-[#0f1115] p-5 text-left hover:border-[#2f81f7] disabled:hover:border-[#30363d]"><span className="text-xs text-[#8b949e]">Seat {seat.seatIndex + 1}</span><span className="mt-2 block font-medium">{seat.occupiedByNickname ?? "Open seat"}</span><span className="mt-1 block text-xs text-[#8b949e]">{seat.occupiedByNickname ? "Ready" : "Click to sit down"}</span></button>)}</div>{isHost && <div className="border-t border-[#30363d] pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-medium">Host controls</p>    <p className="text-sm text-[#8b949e]">Manage the table and safe lifecycle transitions.</p></div><div className="flex flex-wrap gap-2"><Button type="button" className="bg-[#30363d]" onClick={() => setSettingsOpen((open) => !open)}>Settings</Button>{state?.status === "PAUSED" ? <Button type="button" onClick={() => socketRef.current?.emit("RESUME_GAME", {})}>Resume game</Button> : <Button type="button" onClick={() => socketRef.current?.emit("PAUSE_GAME", {})} disabled={state?.status === "ENDED" || state?.status === "END_PENDING"}>Pause game</Button>}<Button type="button" className="bg-[#8b1e2d]" onClick={() => { if (window.confirm("End the game after the current hand finishes?")) socketRef.current?.emit("END_GAME", {}); }} disabled={state?.status === "ENDED" || state?.status === "END_PENDING"}>End game</Button><Button type="button" onClick={() => { setStarting(true); socketRef.current?.emit("START_GAME", {}); window.setTimeout(() => setStarting(false), 1000); }} disabled={starting || (state?.status !== "WAITING" && !(state?.status === "PREPARING" && pokerState?.status === "HAND_COMPLETE"))}>{starting ? "Starting…" : pokerState?.status === "HAND_COMPLETE" ? "Next hand" : "Start game"}</Button></div></div>{settingsOpen && settings && <div className="mt-4 grid gap-3 rounded-md border border-[#30363d] bg-[#0f1115] p-3 text-sm sm:grid-cols-2"><label>Starting stack<Input type="number" value={settings.startingStack} onChange={(e) => updateSetting("startingStack", Number(e.target.value))} /></label><label>Small blind<Input type="number" value={settings.smallBlind} onChange={(e) => updateSetting("smallBlind", Number(e.target.value))} /></label><label>Big blind<Input type="number" value={settings.bigBlind} onChange={(e) => updateSetting("bigBlind", Number(e.target.value))} /></label><label>Turn timer<Input type="number" value={settings.turnTimerSeconds} onChange={(e) => updateSetting("turnTimerSeconds", Number(e.target.value))} /></label><label>Rebuy minimum<Input type="number" value={settings.rebuyMinAmount} onChange={(e) => updateSetting("rebuyMinAmount", Number(e.target.value))} /></label><label>Rebuy maximum<Input type="number" value={settings.rebuyMaxAmount ?? settings.startingStack} onChange={(e) => updateSetting("rebuyMaxAmount", Number(e.target.value))} /></label><Button type="button" onClick={() => socketRef.current?.emit("UPDATE_GAME_SETTINGS", settings)}>Save settings</Button></div>}</div>}</Card><Card className="flex min-h-[360px] flex-col"><h2 className="mb-3 text-lg font-semibold">Table chat</h2><div className="flex-1 space-y-3 overflow-y-auto rounded-md bg-[#0f1115] p-3">{chat.length ? chat.map((item, index) => <p key={`${item.nickname}-${index}`} className="text-sm"><strong>{item.nickname}</strong> <span className="text-[#c9d1d9]">{item.message}</span></p>) : <p className="text-sm text-[#8b949e]">Say hello while everyone joins.</p>}</div><form onSubmit={sendChat} className="mt-3 flex gap-2"><Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Write a message…" maxLength={240} /><Button type="submit" className="px-3">Send</Button></form></Card></div>
  </main>;
}
