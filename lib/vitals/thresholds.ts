import type { Astronaut } from "./crew";

export type CrewStatus = "NOMINAL" | "WARNING" | "CRITICAL";

export type VitalSample = {
  heartRate: number;
  spo2: number;
  bpSys: number;
  bpDia: number;
  respRate: number;
  tempC: number;
};

export function classifyVitals(astronaut: Astronaut, sample: VitalSample): CrewStatus {
  if (
    sample.spo2 < 92 ||
    sample.heartRate >= 150 ||
    sample.heartRate < 40 ||
    sample.respRate >= 30 ||
    sample.bpSys < 90 ||
    sample.tempC >= 39.5
  ) {
    return "CRITICAL";
  }

  if (
    sample.spo2 < 95 ||
    sample.heartRate >= astronaut.baselineHr + 35 ||
    sample.heartRate >= 115 ||
    sample.respRate >= 22 ||
    sample.bpSys >= astronaut.baselineBpSys + 30 ||
    sample.tempC >= 38
  ) {
    return "WARNING";
  }

  return "NOMINAL";
}

export function stepToward(current: number, target: number, noise: number, pull = 0.18): number {
  const next = current + (target - current) * pull + (Math.random() - 0.5) * noise;
  return Math.round(next * 10) / 10;
}
