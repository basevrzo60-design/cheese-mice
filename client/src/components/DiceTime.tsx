import { useState } from "react";
import { hourLabel } from "../../../shared/cheese";
import "./DiceTime.css";

export function DiceTime({ hour }: { hour: number }) {
  const [visible, setVisible] = useState(false);

  return <button type="button" className={`dice-time ${visible ? "open" : ""}`} aria-pressed={visible} onClick={() => setVisible(value => !value)}>
    <span className="dice-time-icon" aria-hidden="true">{visible ? "🎲" : "🔒"}</span>
    <div className="dice-time-details">
      <span className="dice-time-title">เวลาที่ทอยได้</span>
      <strong className="dice-time-value" aria-live="polite">
        {visible ? hourLabel(hour) : "เวลาของคุณถูกปิดไว้"}
      </strong>
      <small>{visible ? "แตะเพื่อปิดเวลา" : "แตะเพื่อดูเวลาของคุณ"}</small>
    </div>
  </button>;
}
