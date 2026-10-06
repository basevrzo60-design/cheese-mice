import { useState } from "react";
import { hourLabel, roleLabel, type CheeseView } from "../../../shared/cheese";
import "./AdminPanel.css";

type Act = (event: string, data?: Record<string, unknown>) => Promise<boolean>;

export function AdminPanel({ s, act, disabled }: { s: CheeseView; act: Act; disabled: boolean }) {
  const admin = s.admin!;
  const savedIds = () => admin.players.filter(p => p.role === "henchman").map(p => p.id);
  const [editing, setEditing] = useState(!admin.rolesSaved);
  const [selected, setSelected] = useState<string[]>(savedIds);
  const editable = ["reveal", "roll", "meeting"].includes(s.phase);
  const name = (id: string) => s.players.find(p => p.id === id)?.name || "ผู้เล่น";

  return <section className="admin-panel" aria-label="แผงแอดมิน">
    <h3>👑 แอดมินดูแลเกม</h3>
    <p>คุณไม่มีบทบาท ไม่ทอยเวลา และไม่ร่วมโหวต ข้อมูลทั้งหมดในช่องนี้เห็นได้เฉพาะคุณ</p>
    <div className="admin-table-wrap"><table className="admin-table">
      <thead><tr><th>ผู้เล่น</th><th>บทบาท</th><th>เวลาที่ทอย</th><th>สถานะ</th>{editable && <th>ลูกสมุน</th>}</tr></thead>
      <tbody>{admin.players.map(p => <tr key={p.id}>
        <th scope="row">{name(p.id)}</th>
        <td>{p.role ? roleLabel(p.role) : "ยังไม่มีบทบาท"}</td>
        <td>{p.hour === null ? "ยังไม่ทอย" : hourLabel(p.hour)}</td>
        <td>{p.vote ? `โหวต ${name(p.vote)}` : s.phase === "reveal" ? p.confirmed ? "พร้อมแล้ว" : "กำลังดูบทบาท" : p.hour === null ? "รอทอยเวลา" : "ทอยแล้ว"}</td>
        {editable && <td>{p.role === "thief" ? "—" : <input type="checkbox" aria-label={`มอบลูกสมุนให้ ${name(p.id)}`} checked={editing ? selected.includes(p.id) : p.role === "henchman"} disabled={disabled || !editing || !p.role} onChange={() => setSelected(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id])}/>}</td>}
      </tr>)}</tbody>
    </table></div>
    {editable && <>
      <p>เลือกได้ตั้งแต่ 0 คนจนถึงผู้เล่นทุกคนที่ไม่ใช่หนูโจร การเลือกจะมีผลเมื่อกดบันทึก</p>
      <div className="actions">
        {editing ? <><button className="primary" disabled={disabled} onClick={async () => { if (await act("admin_roles", { ids: selected })) setEditing(false); }}>บันทึกลูกสมุน ({selected.length} คน)</button>{admin.rolesSaved && <button disabled={disabled} onClick={() => { setSelected(savedIds()); setEditing(false); }}>ยกเลิก</button>}</> : <><span>บันทึกแล้ว · ลูกสมุน {s.henchmenCount} คน</span><button disabled={disabled} onClick={() => { setSelected(savedIds()); setEditing(true); }}>แก้ไขลูกสมุน</button></>}
        {s.phase === "meeting" && <button className="dark" disabled={disabled || editing || !admin.rolesSaved} onClick={() => act("open_vote")}>เปิดให้โหวต →</button>}
      </div>
    </>}
  </section>;
}
