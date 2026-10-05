import { useId, useState } from "react";
import { hourLabel } from "../../../shared/cheese";
import "./DiceTime.css";

export function DiceTime({ hour }: { hour: number }) {
  const [visible, setVisible] = useState(false);
  const valueId = useId();

  return <section className="dice-time" aria-label="เวลาที่ทอยได้">
    <span className="dice-time-icon" aria-hidden="true">🎲</span>
    <div className="dice-time-details">
      <h3>เวลาที่ทอยได้</h3>
      <div id={valueId} className="dice-time-value" aria-live="polite">
        {visible ? hourLabel(hour) : "เวลาของคุณถูกปิดไว้"}
      </div>
      <small>เปิดดูได้โดยไม่ต้องเปิดบทบาท</small>
    </div>
    <button type="button" aria-expanded={visible} aria-controls={valueId} onClick={() => setVisible(value => !value)}>
      {visible ? "ปิดเวลา" : "เปิดดูเวลา"}
    </button>
  </section>;
}
