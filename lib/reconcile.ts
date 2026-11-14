import type { MedicReply, Urgency } from "./types";

const RANK: Record<Urgency, number> = {
  routine: 0,
  elevated: 1,
  critical: 2,
};

/** Drug names and doses the model must not introduce. */
const BANNED =
  /morphine|fentanyl|ketamine|midazolam|diazepam|lorazepam|propofol|succinylcholine|epinephrine|adrenaline|opioid|narcotic|insulin|\b\d+(?:\.\d+)?\s*(?:mg|mcg|µg|ug|ml|iu)\b/i;

const DIAGNOSIS =
  /\byou have (?:a |an )?(?:heart attack|myocardial infarction|stemi|nstemi|acs|stroke)\b|\bi (?:diagnose|prescribe)\b|\bofficial nasa protocol\b/i;

export function maxUrgency(a: Urgency, b: Urgency): Urgency {
  return RANK[a] >= RANK[b] ? a : b;
}

export function kitIsUnsafe(lines: string[]): boolean {
  return lines.some((line) => BANNED.test(line));
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return null;
  }
  return value.map((item) => item.trim()).filter(Boolean);
}

/**
 * Keep Gemini wording when it is usable, but never let it undercut the
 * offline protocol, invent a dose, or turn the reply into a diagnosis.
 * Follow-up questions stay on the offline state machine.
 */
export function reconcileAdvice(
  offline: MedicReply,
  candidate: unknown,
): MedicReply {
  if (!candidate || typeof candidate !== "object") return offline;
  const raw = candidate as Record<string, unknown>;

  const urgency =
    raw.urgency === "routine" ||
    raw.urgency === "elevated" ||
    raw.urgency === "critical"
      ? maxUrgency(offline.urgency, raw.urgency)
      : offline.urgency;

  const summary =
    typeof raw.assessmentSummary === "string" &&
    raw.assessmentSummary.trim() &&
    !DIAGNOSIS.test(raw.assessmentSummary)
      ? raw.assessmentSummary.trim()
      : offline.assessmentSummary;

  const steps = asStringArray(raw.immediateSteps);
  const vitalsNext = asStringArray(raw.vitalsNext);
  const redFlags = asStringArray(raw.redFlags);
  const environmentNotes = asStringArray(raw.environmentNotes);
  const kit = asStringArray(raw.kitGuidance);
  const notes =
    environmentNotes?.length ? [...environmentNotes] : [...offline.environmentNotes];
  for (const note of offline.environmentNotes) {
    if (note.includes("not a pupil measurement") && !notes.some((line) => line.includes("not a pupil measurement"))) {
      notes.push(note);
    }
  }

  return {
    urgency,
    assessmentSummary: summary,
    immediateSteps: steps && steps.length >= 3 ? steps : offline.immediateSteps,
    vitalsNext: vitalsNext?.length ? vitalsNext : offline.vitalsNext,
    redFlags: redFlags?.length ? redFlags : offline.redFlags,
    environmentNotes: notes,
    kitGuidance: kit?.length && !kitIsUnsafe(kit) ? kit : offline.kitGuidance,
    followUpQuestion: offline.followUpQuestion,
    quickReplies: offline.quickReplies,
    disclaimer: offline.disclaimer,
    source: "gemini",
    slot: offline.slot,
  };
}
