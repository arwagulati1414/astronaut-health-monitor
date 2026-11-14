export type ShipZone = {
  id: string;
  label: string;
  aliases: string[];
  position: [number, number, number];
  size: [number, number, number];
  shape: "box" | "cylinder";
  deck: number;
};

export const SHIP_ZONES: ShipZone[] = [
  {
    id: "command_deck",
    label: "COMMAND DECK",
    aliases: ["command deck", "flight deck", "cockpit", "command"],
    position: [0, 1.3, -6.2],
    size: [3.4, 1.3, 2.4],
    shape: "box",
    deck: 1,
  },
  {
    id: "corridor_main",
    label: "MAIN CORRIDOR",
    aliases: ["main corridor", "corridor", "spine"],
    position: [0, 0.7, 0],
    size: [1.35, 1.15, 9.2],
    shape: "box",
    deck: 1,
  },
  {
    id: "crew_quarters",
    label: "CREW QUARTERS",
    aliases: ["crew quarters", "sleep station", "quarters", "bunk"],
    position: [-3.5, 0.75, -2.2],
    size: [2.6, 1.2, 2.4],
    shape: "box",
    deck: 1,
  },
  {
    id: "medical_bay",
    label: "MEDICAL BAY",
    aliases: ["medical bay", "med bay", "infirmary", "sickbay", "medical"],
    position: [3.5, 0.75, -2.2],
    size: [2.6, 1.2, 2.4],
    shape: "box",
    deck: 1,
  },
  {
    id: "galley",
    label: "GALLEY",
    aliases: ["galley", "wardroom", "mess"],
    position: [-3.5, 0.75, 1.4],
    size: [2.5, 1.15, 2.1],
    shape: "box",
    deck: 1,
  },
  {
    id: "lab",
    label: "LAB",
    aliases: ["lab module", "laboratory", "science lab", "lab"],
    position: [3.5, 0.75, 1.4],
    size: [2.5, 1.15, 2.2],
    shape: "box",
    deck: 1,
  },
  {
    id: "gym",
    label: "GYM",
    aliases: ["gym", "exercise device", "exercise bay"],
    position: [-3.6, 0.75, 4.6],
    size: [2.5, 1.2, 2.2],
    shape: "box",
    deck: 1,
  },
  {
    id: "airlock",
    label: "AIRLOCK",
    aliases: ["airlock", "suitlock"],
    position: [3.7, 0.8, 4.6],
    size: [1.15, 1.5, 1.15],
    shape: "cylinder",
    deck: 1,
  },
  {
    id: "engineering",
    label: "ENGINEERING",
    aliases: ["engineering", "engine bay"],
    position: [0, 0.85, 6.6],
    size: [1.5, 1.6, 1.5],
    shape: "cylinder",
    deck: 0,
  },
  {
    id: "cargo_bay",
    label: "CARGO BAY",
    aliases: ["cargo bay", "cargo"],
    position: [0, 0.55, -3.2],
    size: [2.2, 0.9, 1.8],
    shape: "box",
    deck: 0,
  },
  {
    id: "greenhouse",
    label: "GREENHOUSE",
    aliases: ["greenhouse", "plants", "garden"],
    position: [6.2, 0.75, 0.2],
    size: [2.1, 1.2, 3.2],
    shape: "box",
    deck: 1,
  },
];

export function zoneById(id: string | null | undefined): ShipZone | undefined {
  return SHIP_ZONES.find((zone) => zone.id === id);
}

/** Longest alias wins, so "medical bay" beats a shorter fragment. */
export function matchZone(text: string): ShipZone | null {
  const haystack = text.toLowerCase();
  const aliases = SHIP_ZONES.flatMap((zone) =>
    zone.aliases.map((alias) => ({ zone, alias: alias.toLowerCase() })),
  ).sort((a, b) => b.alias.length - a.alias.length);

  for (const entry of aliases) {
    const pattern = new RegExp(`\\b${entry.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    if (pattern.test(haystack)) return entry.zone;
  }
  return null;
}
