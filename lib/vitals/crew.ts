export type CrewRole =
  | "commander"
  | "pilot"
  | "engineer"
  | "scientist"
  | "medical_officer"
  | "specialist";

export type Astronaut = {
  id: string;
  callsign: string;
  fullName: string;
  role: CrewRole;
  age: number;
  sex: "F" | "M";
  zoneId: string;
  baselineHr: number;
  baselineSpo2: number;
  baselineBpSys: number;
  baselineBpDia: number;
  baselineTemp: number;
  baselineResp: number;
};

export const MISSION = {
  id: "mission-ares-7",
  name: "ARES-7",
  shipName: "ORBITAL MEDIC",
};

export const CREW: Astronaut[] = [
  {
    id: "nova",
    callsign: "NOVA",
    fullName: "Nova Reyes",
    role: "commander",
    age: 41,
    sex: "F",
    zoneId: "command_deck",
    baselineHr: 62,
    baselineSpo2: 98,
    baselineBpSys: 118,
    baselineBpDia: 74,
    baselineTemp: 36.6,
    baselineResp: 14,
  },
  {
    id: "kai",
    callsign: "KITE",
    fullName: "Kai Okonkwo",
    role: "pilot",
    age: 36,
    sex: "M",
    zoneId: "command_deck",
    baselineHr: 66,
    baselineSpo2: 98,
    baselineBpSys: 122,
    baselineBpDia: 76,
    baselineTemp: 36.7,
    baselineResp: 15,
  },
  {
    id: "amira",
    callsign: "BOLT",
    fullName: "Amira Shah",
    role: "engineer",
    age: 34,
    sex: "F",
    zoneId: "engineering",
    baselineHr: 70,
    baselineSpo2: 97,
    baselineBpSys: 116,
    baselineBpDia: 72,
    baselineTemp: 36.5,
    baselineResp: 15,
  },
  {
    id: "jonah",
    callsign: "QUILL",
    fullName: "Jonah Park",
    role: "scientist",
    age: 38,
    sex: "M",
    zoneId: "lab",
    baselineHr: 64,
    baselineSpo2: 98,
    baselineBpSys: 120,
    baselineBpDia: 78,
    baselineTemp: 36.6,
    baselineResp: 14,
  },
  {
    id: "lena",
    callsign: "LENS",
    fullName: "Lena Vogt",
    role: "medical_officer",
    age: 44,
    sex: "F",
    zoneId: "medical_bay",
    baselineHr: 60,
    baselineSpo2: 99,
    baselineBpSys: 114,
    baselineBpDia: 70,
    baselineTemp: 36.5,
    baselineResp: 13,
  },
];

export const MEDKIT = [
  "Pulse oximeter",
  "Blood pressure cuff",
  "Supplemental oxygen",
  "Manifested defibrillator",
  "Sterile saline",
  "Rigid eye shield",
  "Crew restraint",
  "Thermometer",
];
