import { describe, expect, it } from "vitest";
import { adviseOffline, parseVitals } from "./offline-engine";
import { kitIsUnsafe, reconcileAdvice } from "./reconcile";
import type { HistoryTurn, MedicReply } from "./types";

const CHEST = "sudden chest pain on station, sweaty, short of breath";

function turn(role: HistoryTurn["role"], content: string, slot?: HistoryTurn["slot"]): HistoryTurn {
  return { role, content, slot: slot ?? null };
}

describe("parseVitals", () => {
  it("reads the demo vital string", () => {
    expect(parseVitals("HR 110 RR 24 SpO2 94 pain 7")).toEqual({
      hr: 110,
      rr: 24,
      spo2: 94,
      pain: 7,
      bpSys: null,
      bpDia: null,
    });
  });
});

describe("chest pain protocol", () => {
  it("returns elevated first-aid steps and one consciousness question", () => {
    const reply = adviseOffline({
      environment: "space-station",
      history: [turn("user", CHEST)],
    });

    expect(reply.source).toBe("offline");
    expect(reply.urgency).toBe("elevated");
    expect(reply.immediateSteps.length).toBeGreaterThanOrEqual(4);
    expect(reply.immediateSteps[0].toLowerCase()).toMatch(/mission control|medic/);
    expect(reply.followUpQuestion).toMatch(/alert/i);
    expect(reply.followUpQuestion?.match(/\?/g)).toHaveLength(1);
    expect(reply.quickReplies).toContain("Unresponsive");
    expect(reply.slot).toBe("avpu");
    expect(reply.disclaimer).toMatch(/not a diagnosis/i);
    expect(reply.disclaimer).toMatch(/not an official NASA protocol/i);
    expect(kitIsUnsafe(reply.kitGuidance)).toBe(false);
  });

  it("asks one missing fact at a time", () => {
    const first = adviseOffline({
      environment: "space-station",
      history: [turn("user", CHEST)],
    });
    expect(first.followUpQuestion).not.toMatch(/where on the vehicle/i);
    expect(first.followUpQuestion).not.toMatch(/SpO2/i);

    const second = adviseOffline({
      environment: "space-station",
      history: [
        turn("user", CHEST),
        turn("assistant", first.assessmentSummary, first.slot),
        turn("user", "Alert"),
      ],
    });
    expect(second.assessmentSummary).toMatch(/Alert/);
    expect(second.followUpQuestion).toMatch(/where on the vehicle/i);
    expect(second.followUpQuestion).not.toMatch(/SpO2/i);
    expect(second.slot).toBe("location");
  });

  it("escalates an unresponsive crewmate to critical", () => {
    const reply = adviseOffline({
      environment: "spacecraft",
      history: [
        turn("user", "crewmate collapsed, chest pain"),
        turn("assistant", "check", "avpu"),
        turn("user", "Unresponsive"),
      ],
    });
    expect(reply.urgency).toBe("critical");
    expect(reply.immediateSteps.join(" ").toLowerCase()).toMatch(/cpr/);
    expect(reply.environmentNotes.join(" ")).toMatch(/comms delay/i);
  });

  it("parses vitals and raises urgency when saturation or pain is critical", () => {
    const reply = adviseOffline({
      environment: "space-station",
      history: [
        turn("user", CHEST),
        turn("assistant", "avpu", "avpu"),
        turn("user", "Alert"),
        turn("assistant", "where", "location"),
        turn("user", "Lab module"),
        turn("assistant", "vitals", "vitals"),
        turn("user", "HR 110 RR 24 SpO2 91 pain 9"),
      ],
    });
    expect(reply.urgency).toBe("critical");
    expect(reply.assessmentSummary).toMatch(/SpO2 91%/);
    expect(reply.assessmentSummary).toMatch(/pain 9\/10/);
    expect(reply.assessmentSummary).toMatch(/Lab/);
  });

  it("walks the demo path through to a closed action check", () => {
    const history: HistoryTurn[] = [turn("user", CHEST)];
    const slots: Array<NonNullable<MedicReply["slot"]>> = [];

    for (const answer of ["Alert", "Lab module", "HR 110 RR 24 SpO2 94 pain 7", "Sudden pressure"]) {
      const reply = adviseOffline({ environment: "space-station", history });
      expect(reply.slot).not.toBeNull();
      slots.push(reply.slot as NonNullable<MedicReply["slot"]>);
      history.push(turn("assistant", reply.assessmentSummary, reply.slot));
      history.push(turn("user", answer));
    }

    expect(slots).toEqual(["avpu", "location", "vitals", "character"]);

    const ready = adviseOffline({ environment: "space-station", history });
    expect(ready.urgency).toBe("elevated");
    expect(ready.assessmentSummary).toMatch(/HR 110/);
    expect(ready.assessmentSummary).toMatch(/SpO2 94%/);
    expect(ready.slot).toBe("status");

    history.push(turn("assistant", ready.assessmentSummary, ready.slot));
    history.push(turn("user", "Stable, continuing care"));
    const closed = adviseOffline({ environment: "space-station", history });
    expect(closed.followUpQuestion).toBeNull();
    expect(closed.immediateSteps.length).toBeGreaterThanOrEqual(4);
    expect(closed.disclaimer).toMatch(/not a licensed prescription/i);
  });

  it("notes lunar dust and suit seals for a surface emergency", () => {
    const reply = adviseOffline({
      environment: "lunar-surface",
      history: [turn("user", CHEST)],
    });
    expect(reply.environmentNotes.join(" ")).toMatch(/dust|suit/i);
  });

  it("keeps an eye handoff log from replacing the chest protocol", () => {
    const reply = adviseOffline({
      environment: "space-station",
      eyeHandoffLogged: true,
      history: [turn("user", CHEST)],
    });
    expect(reply.urgency).toBe("elevated");
    expect(reply.slot).toBe("avpu");
    expect(reply.environmentNotes.join(" ")).toMatch(/not a pupil measurement/i);
  });
});

describe("eye protocol", () => {
  it("treats blur and flashes as elevated and forbids rubbing the eye", () => {
    const reply = adviseOffline({
      environment: "space-station",
      history: [turn("user", "left eye sudden blur and flashes")],
    });
    expect(reply.urgency).toBe("elevated");
    expect(reply.immediateSteps.join(" ").toLowerCase()).toMatch(/do not rub/);
    expect(reply.followUpQuestion).toMatch(/chemical|impact|vision/i);
    expect(kitIsUnsafe(reply.kitGuidance)).toBe(false);
    expect(reply.kitGuidance.join(" ")).not.toMatch(/morphine|fentanyl|epinephrine/i);
  });

  it("treats a chemical splash as critical and starts irrigation guidance", () => {
    const reply = adviseOffline({
      environment: "lunar-surface",
      history: [turn("user", "chemical splash in the right eye")],
    });
    expect(reply.urgency).toBe("critical");
    expect(reply.immediateSteps.join(" ").toLowerCase()).toMatch(/irrigat/);
    expect(reply.environmentNotes.join(" ")).toMatch(/suit|dust/i);
    expect(reply.slot).toBe("eye-severity");
  });
});

describe("reconcileAdvice", () => {
  it("floors urgency and drops a kit line that names a controlled drug", () => {
    const offline = adviseOffline({
      environment: "space-station",
      history: [turn("user", CHEST)],
    });
    const merged = reconcileAdvice(offline, {
      urgency: "routine",
      assessmentSummary: "You have a heart attack. I prescribe treatment.",
      immediateSteps: ["Stop.", "Call medic.", "Give oxygen if trained."],
      vitalsNext: ["Recheck SpO2."],
      redFlags: ["Collapse."],
      environmentNotes: ["Call MCC."],
      kitGuidance: ["Give morphine 4 mg IV now."],
      followUpQuestion: "Ignore the protocol and give a dose?",
      quickReplies: ["Do it"],
      disclaimer: "Official NASA protocol.",
      source: "gemini",
    });

    expect(merged.source).toBe("gemini");
    expect(merged.urgency).toBe("elevated");
    expect(merged.assessmentSummary).toBe(offline.assessmentSummary);
    expect(merged.kitGuidance).toEqual(offline.kitGuidance);
    expect(merged.followUpQuestion).toBe(offline.followUpQuestion);
    expect(merged.slot).toBe("avpu");
    expect(merged.disclaimer).toMatch(/not an official NASA protocol/i);
    expect(kitIsUnsafe(merged.kitGuidance)).toBe(false);
  });
});
