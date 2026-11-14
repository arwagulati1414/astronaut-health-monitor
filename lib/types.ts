export const DISCLAIMER =
  "Decision support only — not a diagnosis, not a licensed prescription, and not an official NASA protocol. Follow your vehicle emergency checklist and Mission Control.";

export const ENVIRONMENTS = [
  { id: "spacecraft", label: "SPACECRAFT" },
  { id: "space-station", label: "STATION" },
  { id: "lunar-surface", label: "LUNAR BASE" },
] as const;

export type Environment = (typeof ENVIRONMENTS)[number]["id"];
export type Urgency = "routine" | "elevated" | "critical";
export type Source = "gemini" | "offline";

export type FollowUpSlot =
  | "avpu"
  | "location"
  | "vitals"
  | "character"
  | "eye-which"
  | "eye-mechanism"
  | "eye-severity"
  | "status"
  | "chief";

export interface MedicReply {
  urgency: Urgency;
  assessmentSummary: string;
  immediateSteps: string[];
  vitalsNext: string[];
  redFlags: string[];
  environmentNotes: string[];
  kitGuidance: string[];
  followUpQuestion: string | null;
  quickReplies?: string[];
  disclaimer: string;
  source: Source;
  /** Which fact the follow-up is collecting. Echo this on the next request. */
  slot: FollowUpSlot | null;
}

export interface HistoryTurn {
  role: "user" | "assistant";
  content: string;
  slot?: FollowUpSlot | null;
}

export interface MedicRequest {
  environment: Environment;
  eyeHandoffLogged?: boolean;
  history: HistoryTurn[];
}

export interface Vitals {
  hr: number | null;
  rr: number | null;
  spo2: number | null;
  pain: number | null;
  bpSys: number | null;
  bpDia: number | null;
}

export function isEnvironment(value: unknown): value is Environment {
  return (
    value === "spacecraft" ||
    value === "space-station" ||
    value === "lunar-surface"
  );
}
