import type { CheeseRole } from "../../../shared/cheese";
import { roleLabel } from "../../../shared/cheese";
import "./RoleArtwork.css";

const roleImages: Record<CheeseRole, string> = {
  mouse: "/images/roles/mouse.png",
  thief: "/images/roles/thief.png",
  henchman: "/images/roles/henchman.png",
};

export function RoleArtwork({ role, compact = false, decorative = false }: {
  role: CheeseRole; compact?: boolean; decorative?: boolean;
}) {
  return <img className={`role-artwork${compact ? " compact" : ""}`} src={roleImages[role]}
    alt={decorative ? "" : roleLabel(role)} width={compact ? 48 : 220} height={compact ? 48 : 220}/>;
}
