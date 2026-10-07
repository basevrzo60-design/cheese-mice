import type { CheeseView } from "../../../shared/cheese";
import { AdminPanel } from "./AdminPanel";
import "./ManualDashboard.css";

type Act = (event: string, data?: Record<string, unknown>) => Promise<boolean>;

export function ManualDashboard({ s, act, disabled }: { s: CheeseView; act: Act; disabled: boolean }) {
  const stages = [
    { label: "ดูบทบาท", phases: ["lobby", "reveal"] },
    { label: "สุ่มเวลาตื่น", phases: ["roll"] },
    { label: "จัดลูกสมุน", phases: ["meeting"] },
    { label: "โหวตจับโจร", phases: ["vote", "result"] },
  ];
  const active = stages.findIndex(stage => stage.phases.includes(s.phase));
  const status = s.phase === "lobby" ? "รอผู้เล่นพร้อม"
    : s.phase === "reveal" ? `พร้อมแล้ว ${s.confirmedCount}/${s.participantCount} คน`
    : s.phase === "roll" ? "ผู้เล่นกำลังสุ่มเวลา"
    : s.phase === "meeting" ? "แอดมินกำลังจัดทีม"
    : s.phase === "vote" ? `โหวตแล้ว ${s.voteCount}/${s.participantCount} คน` : "จบรอบแล้ว";
  return <section className="manual-dashboard" aria-label="ภาพรวมโหมด 2">
    <div className="manual-overview"><div className="manual-overview-heading"><div><span className="eyebrow">MODE 02 · GAME ROOM</span><h2>{s.admin ? "ห้องควบคุมเกม" : "วงสนทนาของเหล่าหนู"}</h2></div><span className="manual-user-badge">{s.admin ? "👑 แอดมิน" : "🐭 ผู้เล่น"}</span></div>
      <p>{s.admin ? "ดูข้อมูลผู้เล่น จัดลูกสมุน และคุมการโหวตได้จากที่เดียว" : "ดูบทบาทและเวลาของคุณ แล้วพูดคุยกับเพื่อนเพื่อหาหนูโจร"}</p>
      <ol className="manual-stages">{stages.map((stage, index) => <li key={stage.label} className={index === active ? "current-stage" : index < active ? "completed-stage" : ""} aria-current={index === active ? "step" : undefined}><span>{index < active ? "✓" : index + 1}</span><strong>{stage.label}</strong></li>)}</ol>
      <div className="manual-summary"><div><small>ผู้เล่น</small><strong>{s.participantCount} คน</strong></div><div><small>ลูกสมุน</small><strong>{s.henchmenCount} คน</strong></div><div><small>สถานะห้อง</small><strong>{status}</strong></div></div>
    </div>
    {s.admin && s.phase !== "lobby" && s.phase !== "result" && <div className="manual-admin-card"><AdminPanel s={s} act={act} disabled={disabled}/></div>}
  </section>;
}
