export type CheeseMode = "timed" | "manual";
export type CheesePhase = "lobby" | "reveal" | "roll" | "night" | "recruit" | "meeting" | "vote" | "result";
export type CheeseRole = "mouse" | "thief" | "henchman";

export type CheeseSession = { code: string; id: string; token: string };

export type CheeseView = {
  code: string;
  name: string;
  capacity: number;
  mode: CheeseMode;
  hostId: string;
  phase: CheesePhase;
  hour: number;
  deadline: number | null;
  timerSeconds: number;
  paused: boolean;
  players: { id: string; name: string; connected: boolean; ready: boolean; bot: boolean }[];
  confirmedCount: number;
  voteCount: number;
  henchmenCount: number;
  participantCount: number;
  admin: null | {
    rolesSaved: boolean;
    players: { id: string; role: CheeseRole | null; hour: number | null; confirmed: boolean; vote: string | null }[];
  };
  cards: { index: number; taken: boolean }[];
  me: {
    id: string;
    role: CheeseRole | null;
    hour: number | null;
    confirmed: boolean;
    rolled: boolean;
    awake: boolean;
    companions: string[];
    canPeek: boolean;
    peek: { id: string; hour: number } | null;
    cheeseStolen: boolean;
    tableCheesePresent: boolean | null;
    witnessedTheft: boolean;
    nightDone: boolean;
    team: string[];
    voted: boolean;
    canVote: boolean;
  };
  result: null | {
    winner: "mice" | "thieves";
    accused: string | null;
    tied: boolean;
    players: { id: string; role: CheeseRole; hour: number; votes: number }[];
  };
};

export const henchmenFor = (playerCount: number) =>
  Math.max(1, Math.floor((playerCount - 1) / 3));
export const hourLabel = (hour: number) => (hour === 6 ? "6 โมงเช้า" : `ตี ${hour}`);
export const roleLabel = (role: CheeseRole | null) =>
  role === "thief" ? "หนูโจร" : role === "henchman" ? "หนูลูกสมุน" : "หนูธรรมดา";
