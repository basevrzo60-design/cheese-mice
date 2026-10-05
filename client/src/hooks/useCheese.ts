import { useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type { CheeseSession, CheeseView } from "../../../shared/cheese";
type Reply = { ok: boolean; error?: string; session?: CheeseSession };
const key = "cheese-mice-session-v2";
export function useCheese() {
  const [view, setView] = useState<CheeseView | null>(null);
  const [connected, setConnected] = useState(false);
  const [recovering, setRecovering] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const socket = useRef<Socket | null>(null), session = useRef<CheeseSession | null>(null), pending = useRef(false);
  const save = (value: CheeseSession | null) => {
    session.current = value;
    try { if (value) localStorage.setItem(key, JSON.stringify(value)); else localStorage.removeItem(key); } catch { /* Keep the current session in memory. */ }
  };
  useEffect(() => {
    try { session.current = JSON.parse(localStorage.getItem(key) || "null"); } catch { session.current = null; }
    const client = io(`${(import.meta.env.VITE_SERVER_URL || "").replace(/\/$/, "")}/cheese`, { autoConnect: false });
    socket.current = client;
    client.on("state", state => { setView(state); setRecovering(false); });
    client.on("removed", message => { save(null); setView(null); setRecovering(false); setError(message); });
    client.on("superseded", () => { session.current = null; setView(null); setRecovering(false); setError("ที่นั่งของคุณเปิดในหน้าต่างใหม่แล้ว ใช้หน้าต่างนั้นเล่นต่อ"); });
    client.on("connect", () => {
      setConnected(true); setError("");
      if (!session.current) { setRecovering(false); return; }
      setRecovering(true);
      client.timeout(8000).emit("action", { event: "rejoin", data: session.current }, (err: Error | null, reply: Reply) => {
        setRecovering(false);
        if (err) { setError("คืนที่นั่งยังไม่สำเร็จ กดเชื่อมต่อใหม่เพื่อลองอีกครั้ง"); return; }
        if (!reply.ok) { save(null); setView(null); setError(reply.error || "คืนที่นั่งไม่ได้"); }
      });
    });
    client.on("disconnect", () => { setConnected(false); setBusy(false); pending.current = false; });
    client.on("connect_error", () => { setConnected(false); setRecovering(false); setError("เชื่อมต่อไม่ได้ กำลังลองใหม่อัตโนมัติ"); });
    client.connect();
    return () => { client.removeAllListeners(); client.disconnect(); socket.current = null; };
  }, []);
  async function act(event: string, data: Record<string, unknown> = {}): Promise<boolean> {
    if (!socket.current?.connected || recovering || pending.current) return false;
    pending.current = true; setBusy(true); setError("");
    return new Promise(resolve => socket.current!.timeout(8000).emit("action", { event, data }, (err: Error | null, reply: Reply) => {
      pending.current = false; setBusy(false);
      if (err || !reply.ok) { setError(err ? "ยังไม่ได้รับคำตอบ ลองเชื่อมต่อใหม่เพื่อดูสถานะล่าสุด" : reply.error || "ทำรายการไม่สำเร็จ"); resolve(false); return; }
      if (reply.session) save(reply.session);
      if (event === "leave") { save(null); setView(null); }
      resolve(true);
    }));
  }
  const reconnect = () => { socket.current?.disconnect(); socket.current?.connect(); };
  return { view, connected, recovering, busy, error, setError, act, reconnect };
}
