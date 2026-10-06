import { roleLabel, type CheeseView } from "../../../shared/cheese";
import { DiceTime } from "./DiceTime";
import { RoleArtwork } from "./RoleArtwork";
import "./PersonalCards.css";

export function PersonalCards({ s, shown, onToggle }: { s: CheeseView; shown: boolean; onToggle: () => void }) {
  const name = (id: string) => s.players.find(p => p.id === id)?.name || "ผู้เล่น";
  return <section className="panel personal-panel" aria-label="บทบาทและเวลาของคุณ">
    <div className="personal-heading"><h3>ข้อมูลของคุณ</h3><span>🔒 ส่วนตัว</span></div>
    <button className={`secret ${shown ? "open" : ""}`} aria-pressed={shown} onClick={onToggle}>
      {shown && s.me.role ? <RoleArtwork role={s.me.role} decorative/> : <span aria-hidden="true">🔒</span>}
      <strong>{shown && s.me.role ? roleLabel(s.me.role) : "บทบาทของคุณถูกปิดไว้"}</strong>
      <small>{shown ? "แตะเพื่อปิดบทบาท" : "แตะเพื่อดูบทบาทเฉพาะตัว"}</small>
    </button>
    {shown && s.me.team.length > 0 && <div className="note">ทีมโจรของคุณ: {s.me.team.map(name).join(", ")}</div>}
    {s.me.hour !== null && <DiceTime hour={s.me.hour}/>}
  </section>;
}
