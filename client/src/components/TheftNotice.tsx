import { useState } from "react";
import "./TheftNotice.css";

export function TheftNotice() {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;
  return <div className="theft-notice" role="status">
    <span className="theft-notice-icon" aria-hidden="true">🧀💨</span>
    <div><strong>โจรขโมยชีสแล้ว!</strong><span>ชีสกลางโต๊ะหายไป ในช่วงที่คุณตื่นอยู่</span></div>
    <button type="button" aria-label="ปิดข้อความโจรขโมยชีส" onClick={() => setDismissed(true)}>×</button>
  </div>;
}
