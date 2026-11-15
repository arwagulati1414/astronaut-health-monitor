import { describe, expect, it } from "vitest";
import { nasaContextFor } from "@/lib/nasa/hrr";

describe("NASA Human Research Roadmap context", () => {
  it("cites the cardiovascular risk for a chest-pain report", () => {
    const risks = nasaContextFor("sudden chest pain, sweaty, short of breath");
    expect(risks.map((risk) => risk.id)).toEqual(["cardiovascular"]);
    expect(risks[0]?.url).toMatch(/^https:\/\/humanresearchroadmap\.nasa\.gov\//);
  });

  it("cites SANS for a vision report and keeps both when the thread has both", () => {
    const risks = nasaContextFor("left eye sudden blur\nHR 110");
    expect(risks.map((risk) => risk.id)).toEqual(["cardiovascular", "sans"]);
  });

  it("does not invent a risk for an unrelated note", () => {
    expect(nasaContextFor("I'm in the gym")).toEqual([]);
  });
});