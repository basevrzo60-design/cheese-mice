import { useEffect, useRef, useState } from "react";
import type { CheeseView } from "../../../shared/cheese";
import "./RoomChat.css";

type Act = (event: string, data?: Record<string, unknown>) => Promise<boolean>;

export function RoomChat({ s, act, disabled, draft, onDraftChange }: {
  s: CheeseView; act: Act; disabled: boolean; draft: string; onDraftChange: (value: string) => void;
}) {
  const list = useRef<HTMLOListElement>(null);
  const nearBottom = useRef(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(false);
  const messages = s.chat || [];
  const lastId = messages.at(-1)?.id;
  const lastSender = messages.at(-1)?.playerId;
  const scrollToLatest = () => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
    nearBottom.current = true; setUnread(false);
  };
  useEffect(() => {
    if (nearBottom.current || lastSender === s.me.id) scrollToLatest();
    else setUnread(true);
  }, [lastId, lastSender, s.me.id]);

  return <section className="panel room-chat" aria-label="แชทในห้อง">
    <div className="chat-heading"><div><span className="eyebrow">ROOM CONVERSATION</span><h3>💬 คุยกันในห้อง</h3></div><span className="chat-audience">ทุกคนในห้อง</span></div>
    <ol ref={list} className="chat-messages" role="log" aria-label="ข้อความแชท" aria-live="polite" aria-relevant="additions" onScroll={() => {
      const el = list.current!;
      nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 70;
      if (nearBottom.current) setUnread(false);
    }}>
      {!messages.length && <li className="chat-empty"><span aria-hidden="true">💭</span><strong>เริ่มบทสนทนากันเลย</strong><span>ทักทายเพื่อน แชร์เบาะแส แล้วช่วยกันหาหนูโจร</span></li>}
      {messages.map(message => <li key={message.id} className={message.playerId === s.me.id ? "chat-message own-message" : "chat-message"}>
        <div className="chat-message-meta"><strong>{message.name}{message.playerId === s.me.id && <small> คุณ</small>}</strong><time dateTime={new Date(message.sentAt).toISOString()}>{new Date(message.sentAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", hour12: false })}</time></div>
        <div className="chat-bubble">{message.text}</div>
      </li>)}
    </ol>
    {unread && <button className="chat-latest" onClick={scrollToLatest}>ข้อความใหม่ ↓</button>}
    {error && <p className="chat-error" role="alert">{error}</p>}
    <form className="chat-compose" onSubmit={async e => {
      e.preventDefault();
      const text = draft.trim();
      if (!text || disabled || sending) return;
      setSending(true); setError("");
      try {
        if (await act("chat", { text })) onDraftChange("");
        else setError("ส่งข้อความไม่สำเร็จ รอสักครู่แล้วลองอีกครั้ง");
      } finally { setSending(false); }
    }}>
      <label className="chat-input-label" htmlFor="room-chat-input">ข้อความถึงทุกคน</label>
      <div className="chat-compose-row"><textarea id="room-chat-input" rows={2} maxLength={500} value={draft} disabled={disabled || sending} onChange={e => onDraftChange(e.target.value)} placeholder="พิมพ์ข้อความคุยกับเพื่อน…" onKeyDown={e => {
        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); }
      }}/><button className="primary" disabled={disabled || sending || !draft.trim()}>{sending ? "กำลังส่ง…" : "ส่ง ↗"}</button></div>
      <div className="chat-compose-hint"><span>Enter ส่ง · Shift + Enter ขึ้นบรรทัดใหม่</span><span>{draft.length}/500</span></div>
    </form>
  </section>;
}
