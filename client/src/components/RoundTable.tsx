import { type CSSProperties } from "react";
import { hourLabel, type CheeseView } from "../../../shared/cheese";
import "./RoundTable.css";

function MouseAvatar({ awake }: { awake: boolean }) {
  return <svg viewBox="0 0 100 100" aria-hidden="true">
    <ellipse cx="50" cy="91" rx="30" ry="6" fill="#342618" opacity=".2"/>
    <path d="M25 87Q28 60 50 60Q72 60 75 87" fill="#cbbfac" stroke="#554b41" strokeWidth="3"/>
    <circle cx="24" cy="28" r="17" fill="#ddd3c3" stroke="#554b41" strokeWidth="3"/>
    <circle cx="76" cy="28" r="17" fill="#ddd3c3" stroke="#554b41" strokeWidth="3"/>
    <circle cx="24" cy="28" r="11" fill="#e7adab"/><circle cx="76" cy="28" r="11" fill="#e7adab"/>
    <path d="M22 46Q23 23 50 23Q77 23 78 46Q80 72 50 78Q20 72 22 46" fill="#eee6d8" stroke="#554b41" strokeWidth="3"/>
    {awake ? <><ellipse cx="37" cy="48" rx="4" ry="6" fill="#39332c"/><ellipse cx="63" cy="48" rx="4" ry="6" fill="#39332c"/><circle cx="38" cy="46" r="1.4" fill="white"/><circle cx="64" cy="46" r="1.4" fill="white"/></> : <path d="M31 48Q37 54 43 48M57 48Q63 54 69 48" fill="none" stroke="#554b41" strokeWidth="3" strokeLinecap="round"/>}
    <ellipse cx="50" cy="61" rx="5" ry="4" fill="#cc8f8e"/>
    <path d="M50 65V69M21 58L7 54M21 64L6 65M79 58L93 54M79 64L94 65" stroke="#554b41" strokeWidth="2" strokeLinecap="round"/>
  </svg>;
}

export function RoundTable({ s, disabled, onPeek }: { s: CheeseView; disabled: boolean; onPeek: (id: string) => void }) {
  const night = s.phase === "night";
  const lit = !night || s.me.awake;
  // Only the server-provided companions are visible; never infer other wake times.
  const visible = new Set(s.me.awake ? [s.me.id, ...s.me.companions] : []);
  const seats = [...s.players.filter(p => p.id === s.me.id), ...s.players.filter(p => p.id !== s.me.id)];
  const count = s.phase === "lobby" ? s.capacity : seats.length;
  const title = night ? s.me.awake ? "ถึงเวลาของคุณแล้ว" : "ทั้งโต๊ะอยู่ในความมืด" : s.phase === "lobby" ? "จองที่นั่งรอบโต๊ะ" : "โต๊ะของเหล่าหนู";

  return <section className={`table-scene ${night ? "is-night" : "is-day"} ${lit ? "table-lit" : "table-dark"}`} aria-label="โต๊ะกลมและผู้เล่นรอบโต๊ะ">
    <div className="table-scene-heading"><div><span>{night ? "NIGHT AT THE TABLE" : "CHEESE MICE CLUB"}</span><h2>{title}</h2></div><div className="table-scene-phase">{night ? `🌙 ${hourLabel(s.hour)}` : "🧀 โต๊ะกลาง"}</div></div>
    <div className={`table-orbit ${count > 8 ? "many-seats" : ""}`}>
      <div className="table-light-pool" aria-hidden="true"/>
      <div className="round-table-top" aria-hidden="true"><div className="table-inner-ring"/><div className="table-centerpiece"><span className="table-cheese">🧀</span><span className="table-cheese-caption">ชีสกลางโต๊ะ</span><span className="table-engraving">CHEESE MICE</span></div></div>
      <ul className="table-seats" aria-label="ที่นั่งผู้เล่น">
        {Array.from({ length: count }, (_, i) => {
          const player = seats[i];
          const angle = Math.PI / 2 + 2 * Math.PI * i / count;
          const position = { left: `${50 + 41 * Math.cos(angle)}%`, top: `${50 + 41 * Math.sin(angle)}%` } as CSSProperties;
          if (!player) return <li key={`empty-${i}`} style={position} className="table-seat empty-seat"><div className="seat-chair"><span>+</span></div><span className="seat-name">ที่ว่าง</span></li>;
          const illuminated = !night || visible.has(player.id);
          const me = player.id === s.me.id;
          const canPeek = s.me.canPeek && !me && !disabled;
          const seatContent = <><div className="seat-chair"><div className="seat-avatar"><MouseAvatar awake={illuminated}/></div>{night && illuminated && <span className="seat-awake-dot" aria-hidden="true"/>}{!player.connected && <span className="seat-offline" aria-hidden="true">!</span>}</div><span className="seat-name" title={player.name}>{player.name}</span><span className="seat-status">{me ? "คุณ" : s.mode === "manual" && player.id === s.hostId ? "แอดมิน" : player.bot ? "บอท" : "ผู้เล่น"}{night && illuminated ? " · ตื่นอยู่" : s.phase === "lobby" && player.ready ? " · พร้อม" : ""}</span></>;
          return <li key={player.id} style={position} className={`table-seat ${illuminated ? "seat-lit" : "seat-dim"} ${me ? "my-seat" : ""}`}>
            {canPeek ? <button className="seat-peek-button" onClick={() => onPeek(player.id)} aria-label={`ดูเวลา ${player.name}`}>{seatContent}<span className="seat-peek-hint">🔎 ดูเวลา</span></button> : <div className="seat-content">{seatContent}</div>}
          </li>;
        })}
      </ul>
    </div>
    <div className="table-scene-footer"><span className="table-light-key"/><span>{night ? s.me.awake ? s.me.companions.length ? "เห็นเฉพาะคุณและเพื่อนที่ตื่นเวลาเดียวกัน" : "คุณตื่นคนเดียว · เลือกคนรอบโต๊ะเพื่อดูเวลาได้" : "รอเวลาตื่นของคุณ · คนที่ตื่นช่วงอื่นยังเป็นความลับ" : "ชีสหนึ่งก้อน กับความลับของทุกคนรอบโต๊ะ"}</span></div>
  </section>;
}
