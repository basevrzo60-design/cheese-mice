import { hourLabel } from "../../../shared/cheese";
import "./PeekClue.css";

export function PeekClue({ name, hour }: { name: string; hour: number }) {
  return <section className="peek-clue" role="status" aria-label="ผลการดูเวลาผู้เล่น">
    <div className="peek-clue-header"><span className="peek-clue-icon" aria-hidden="true">🔎</span><span>พบเบาะแสแล้ว</span><small>🔒 เห็นเฉพาะคุณ</small></div>
    <div className="peek-clue-body">
      <div className="peek-clue-player"><span>ผู้เล่นที่คุณแอบดู</span><strong>{name}</strong></div>
      <div className="peek-clue-hour"><span>เวลาตื่น</span><strong><span aria-hidden="true">🌙</span> {hourLabel(hour)}</strong></div>
    </div>
    <div className="peek-clue-footer">จำเวลานี้ไว้เป็นเบาะแส แล้วกด “เสร็จแล้ว / เข้านอน” เมื่อพร้อม</div>
  </section>;
}
