import { describe, expect, it } from "vitest";
import { matchZone } from "./zones";
import { classifyVitals } from "../vitals/thresholds";
import { CREW } from "../vitals/crew";

describe("matchZone", () => {
  it("maps the demo gym phrase onto the gym module", () => {
    expect(matchZone("I'm in the gym")?.id).toBe("gym");
  });

  it("prefers the medical bay alias over a shorter fragment", () => {
    expect(matchZone("meet me in the medical bay")?.id).toBe("medical_bay");
  });

  it("returns null when the crew have not named a module", () => {
    expect(matchZone("sudden chest pain, sweaty, short of breath")).toBeNull();
  });
});

describe("classifyVitals", () => {
  it("marks a low oxygen saturation as critical", () => {
    const nova = CREW[0];
    expect(
      classifyVitals(nova, {
        heartRate: 80,
        spo2: 90,
        bpSys: 120,
        bpDia: 74,
        respRate: 16,
        tempC: 36.6,
      }),
    ).toBe("CRITICAL");
  });
});
