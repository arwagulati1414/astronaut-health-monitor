"use client";

import { create } from "zustand";
import { CREW, type Astronaut } from "@/lib/vitals/crew";
import { classifyVitals, stepToward, type CrewStatus } from "@/lib/vitals/thresholds";

export type DemoScenario = "normal" | "chest" | "co2";

export type VitalPoint = {
  t: number;
  heartRate: number;
  spo2: number;
  bpSys: number;
  bpDia: number;
  respRate: number;
  tempC: number;
  hrv: number;
  hydration: number;
};

export type HudAlert = {
  id: string;
  astronautId: string | null;
  zoneId: string | null;
  severity: "info" | "warning" | "critical";
  message: string;
  status: "open" | "acknowledged" | "resolved";
  createdAt: string;
};

export type ShipEnvironment = {
  o2: number;
  co2: number;
  pressure: number;
  temp: number;
  radiation: number;
  humidity: number;
};

type HudState = {
  crew: Astronaut[];
  selectedCrewId: string;
  activeZoneId: string | null;
  vitals: Record<string, VitalPoint[]>;
  environment: ShipEnvironment;
  alerts: HudAlert[];
  scenario: DemoScenario;
  menuOpen: boolean;
  presentMode: boolean;
  bootDone: boolean;
  soundOn: boolean;
  checklist: { item: string; done: boolean }[];
  toast: string | null;
  selectCrew: (id: string) => void;
  setActiveZone: (zoneId: string | null) => void;
  setScenario: (scenario: DemoScenario) => void;
  toggleMenu: (open?: boolean) => void;
  togglePresent: () => void;
  finishBoot: () => void;
  toggleSound: () => void;
  setChecklist: (items: string[]) => void;
  toggleCheck: (index: number) => void;
  raiseAlert: (alert: Omit<HudAlert, "id" | "createdAt" | "status"> & { status?: HudAlert["status"] }) => void;
  setAlertStatus: (id: string, status: HudAlert["status"]) => void;
  dismissToast: () => void;
  tick: () => void;
  statusFor: (id: string) => CrewStatus;
};

const BASE_ENV: ShipEnvironment = {
  o2: 20.9,
  co2: 720,
  pressure: 101.3,
  temp: 22.4,
  radiation: 0.16,
  humidity: 46,
};

function unitNoise(index: number): number {
  const value = Math.sin(index * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function seedPoints(astronaut: Astronaut): VitalPoint[] {
  const points: VitalPoint[] = [];
  let heartRate = astronaut.baselineHr;
  let spo2 = astronaut.baselineSpo2;
  let bpSys = astronaut.baselineBpSys;
  let bpDia = astronaut.baselineBpDia;
  let respRate = astronaut.baselineResp;
  let tempC = astronaut.baselineTemp;
  for (let index = 0; index < 48; index += 1) {
    const sway = unitNoise(index + astronaut.baselineHr) - 0.5;
    heartRate = astronaut.baselineHr + sway * 2;
    spo2 = astronaut.baselineSpo2 + sway * 0.4;
    bpSys = astronaut.baselineBpSys + sway * 2;
    bpDia = astronaut.baselineBpDia + sway * 1.2;
    respRate = astronaut.baselineResp + sway * 0.6;
    tempC = astronaut.baselineTemp + sway * 0.08;
    points.push({
      t: index,
      heartRate: Math.round(heartRate),
      spo2: Math.round(spo2),
      bpSys: Math.round(bpSys),
      bpDia: Math.round(bpDia),
      respRate: Math.round(respRate),
      tempC: Math.round(tempC * 10) / 10,
      hrv: Math.round(42 + unitNoise(index + 3) * 8),
      hydration: Math.round(70 + unitNoise(index + 9) * 6),
    });
  }
  return points;
}

function initialVitals(): Record<string, VitalPoint[]> {
  return Object.fromEntries(CREW.map((astronaut) => [astronaut.id, seedPoints(astronaut)]));
}

let tickCount = 48;
const lastCriticalAt: Record<string, number> = {};

export const useHud = create<HudState>((set, get) => ({
  crew: CREW,
  selectedCrewId: CREW[0].id,
  activeZoneId: CREW[0].zoneId,
  vitals: initialVitals(),
  environment: BASE_ENV,
  alerts: [],
  scenario: "normal",
  menuOpen: false,
  presentMode: false,
  bootDone: false,
  soundOn: false,
  checklist: [],
  toast: null,
  selectCrew: (id) => {
    const crew = get().crew.find((member) => member.id === id);
    set({ selectedCrewId: id, activeZoneId: crew?.zoneId ?? get().activeZoneId });
  },
  setActiveZone: (zoneId) => {
    if (!zoneId) {
      set({ activeZoneId: null });
      return;
    }
    const selectedCrewId = get().selectedCrewId;
    set({
      activeZoneId: zoneId,
      crew: get().crew.map((member) =>
        member.id === selectedCrewId ? { ...member, zoneId } : member,
      ),
    });
  },
  setScenario: (scenario) => set({ scenario, toast: null }),
  toggleMenu: (open) => set({ menuOpen: open ?? !get().menuOpen }),
  togglePresent: () => set({ presentMode: !get().presentMode, menuOpen: false }),
  finishBoot: () => set({ bootDone: true }),
  toggleSound: () => set({ soundOn: !get().soundOn }),
  setChecklist: (items) => {
    const current = get().checklist.map((item) => item.item).join("|");
    if (current === items.join("|")) return;
    set({ checklist: items.map((item) => ({ item, done: false })) });
  },
  toggleCheck: (index) =>
    set({
      checklist: get().checklist.map((item, itemIndex) =>
        itemIndex === index ? { ...item, done: !item.done } : item,
      ),
    }),
  raiseAlert: (alert) => {
    const next: HudAlert = {
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      status: alert.status ?? "open",
      astronautId: alert.astronautId,
      zoneId: alert.zoneId,
      severity: alert.severity,
      message: alert.message,
    };
    set({
      alerts: [next, ...get().alerts].slice(0, 24),
      toast: alert.severity === "critical" ? alert.message : get().toast,
      activeZoneId: alert.zoneId ?? get().activeZoneId,
    });
  },
  setAlertStatus: (id, status) =>
    set({
      alerts: get().alerts.map((alert) => (alert.id === id ? { ...alert, status } : alert)),
    }),
  dismissToast: () => set({ toast: null }),
  tick: () => {
    const { crew, scenario, selectedCrewId, environment } = get();
    const vitals = { ...get().vitals };
    tickCount += 1;

    for (const astronaut of crew) {
      const series = vitals[astronaut.id] ?? [];
      const last = series[series.length - 1];
      const chest = scenario === "chest" && astronaut.id === selectedCrewId;
      const heartTarget = astronaut.baselineHr + (chest ? 48 : 0);
      const spo2Target = astronaut.baselineSpo2 - (chest ? 4 : 0);
      const bpTarget = astronaut.baselineBpSys + (chest ? 28 : 0);
      const respTarget = astronaut.baselineResp + (chest ? 8 : 0);
      const point: VitalPoint = {
        t: tickCount,
        heartRate: Math.round(stepToward(last?.heartRate ?? heartTarget, heartTarget, 2.4)),
        spo2: Math.round(stepToward(last?.spo2 ?? spo2Target, spo2Target, 0.5)),
        bpSys: Math.round(stepToward(last?.bpSys ?? bpTarget, bpTarget, 2.2)),
        bpDia: Math.round(stepToward(last?.bpDia ?? astronaut.baselineBpDia, astronaut.baselineBpDia + (chest ? 12 : 0), 1.5)),
        respRate: Math.round(stepToward(last?.respRate ?? respTarget, respTarget, 0.7)),
        tempC: Math.round(stepToward(last?.tempC ?? astronaut.baselineTemp, astronaut.baselineTemp, 0.05) * 10) / 10,
        hrv: Math.max(12, Math.round(stepToward(last?.hrv ?? 46, chest ? 22 : 48, 2))),
        hydration: Math.round(stepToward(last?.hydration ?? 74, 72, 0.4)),
      };
      vitals[astronaut.id] = [...series, point].slice(-96);

      const status = classifyVitals(astronaut, point);
      const now = Date.now();
      if (status === "CRITICAL" && now - (lastCriticalAt[astronaut.id] ?? 0) > 20_000) {
        lastCriticalAt[astronaut.id] = now;
        get().raiseAlert({
          astronautId: astronaut.id,
          zoneId: astronaut.zoneId,
          severity: "critical",
          message: `${astronaut.callsign} vitals crossed a critical threshold. HR ${point.heartRate}, SpO2 ${point.spo2}%.`,
        });
      }
    }

    const co2Target = scenario === "co2" ? 4800 : BASE_ENV.co2;
    set({
      vitals,
      environment: {
        ...environment,
        co2: Math.round(stepToward(environment.co2, co2Target, 30, scenario === "co2" ? 0.12 : 0.25)),
        o2: scenario === "co2" ? 20.4 : BASE_ENV.o2,
      },
    });
  },
  statusFor: (id) => {
    const astronaut = get().crew.find((member) => member.id === id);
    const last = get().vitals[id]?.at(-1);
    if (!astronaut || !last) return "NOMINAL";
    return classifyVitals(astronaut, last);
  },
}));
