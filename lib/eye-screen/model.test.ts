import { describe, expect, it } from "vitest";
import { classProbabilities, eyeHandoffNote, fixturePixels, screenEye } from "@/lib/eye-screen/model";
import weights from "@/lib/eye-screen/weights.json";

describe("eye screen", () => {
  it("matches the training script on the fixture image", () => {
    const probabilities = classProbabilities(fixturePixels());
    expect(probabilities).toHaveLength(weights.fixtureProbs.length);
    probabilities.forEach((probability, index) => {
      expect(probability).toBeCloseTo(weights.fixtureProbs[index], 4);
    });
    expect(probabilities.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 5);
  });

  it("keeps a screen label from reading as a diagnosis", () => {
    const screen = screenEye(fixturePixels());
    expect(screen.probabilities.map((item) => item.label).sort()).toEqual([
      "Bulging eyes",
      "Cataracts",
      "Crossed eyes",
      "Glaucoma",
      "Uveitis",
    ]);
    expect(screen.disclaimer).toMatch(/not a diagnosis/i);
    expect(eyeHandoffNote("2026-11-16T00:00:00.000Z", screen)).toMatch(/not a diagnosis/i);
    expect(eyeHandoffNote("2026-11-16T00:00:00.000Z", null)).toMatch(/unavailable/i);
  });
});
