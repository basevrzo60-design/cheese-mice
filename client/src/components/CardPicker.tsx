import { useEffect, useRef, useState } from "react";
import type { CheeseView } from "../../../shared/cheese";
import "./CardPicker.css";

export function CardPicker({ cards, disabled, onPick, onClose }: {
  cards: CheeseView["cards"]; disabled: boolean;
  onPick: (index: number) => Promise<boolean>; onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  useEffect(() => {
    const dialog = dialogRef.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return <dialog ref={dialogRef} className="card-picker" aria-labelledby="card-picker-title" aria-describedby="card-picker-description" onCancel={onClose}>
    <button className="close" aria-label="ปิดหน้าต่างเลือกการ์ด" onClick={onClose}>×</button>
    <span className="eyebrow">เลือกความลับของคุณ</span>
    <h2 id="card-picker-title">เลือกการ์ดบทบาท 1 ใบ</h2>
    <p id="card-picker-description">การ์ดทุกใบคว่ำอยู่ มีหนูโจร 1 ใบ ที่เหลือเป็นหนูธรรมดา เลือกแล้วเปิดดูบทบาทได้ทางซ้ายของโต๊ะ</p>
    {error && <div className="note" role="alert">{error}</div>}
    <div className="deck">{cards.map(card => <button key={card.index} disabled={disabled || picking || card.taken} aria-label={card.taken ? `การ์ด ${card.index + 1} ถูกเลือกแล้ว` : `เลือกการ์ด ${card.index + 1}`} onClick={async () => {
      setPicking(true); setError("");
      try {
        if (await onPick(card.index)) onClose();
        else setError("เลือกการ์ดไม่สำเร็จ กรุณาเลือกใบที่ยังว่างแล้วลองอีกครั้ง");
      } finally { setPicking(false); }
    }}><span aria-hidden="true">{card.taken ? "✓" : "🐭"}</span><small>{card.taken ? "ถูกเลือกแล้ว" : `การ์ด ${card.index + 1}`}</small></button>)}</div>
    <small className="card-picker-footnote">เลือกคนละ 1 ใบ · บทบาทของคุณเห็นได้เฉพาะคุณ</small>
  </dialog>;
}
