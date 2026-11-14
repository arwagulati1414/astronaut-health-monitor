"use client";

import { useHud, type DemoScenario } from "@/lib/store/hud";

const SCENES: { id: DemoScenario; label: string }[] = [
  { id: "normal", label: "NORMAL OPERATIONS" },
  { id: "chest", label: "SIMULATE CHEST PAIN" },
  { id: "co2", label: "SIMULATE CABIN CO2 RISE" },
];

export function SettingsView() {
  const crew = useHud((state) => state.crew);
  const selectedCrewId = useHud((state) => state.selectedCrewId);
  const selectCrew = useHud((state) => state.selectCrew);
  const scenario = useHud((state) => state.scenario);
  const setScenario = useHud((state) => state.setScenario);
  const soundOn = useHud((state) => state.soundOn);
  const toggleSound = useHud((state) => state.toggleSound);

  async function choose(next: DemoScenario) {
    setScenario(next);
    await fetch("/api/simulate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scenario: next }),
    });
  }

  return (
    <section className="overlay-panel">
      <p className="kicker">DEMO PANEL</p>
      <h2>SETTINGS</h2>
      <p>Pick the crewmate the chest-pain event hits. The map and chat follow that person.</p>
      <div className="crew-tabs">
        {crew.map((member) => (
          <button
            key={member.id}
            type="button"
            className={member.id === selectedCrewId ? "on" : ""}
            onClick={() => selectCrew(member.id)}
          >
            {member.callsign}
          </button>
        ))}
      </div>
      <div className="demo-actions">
        {SCENES.map((item) => (
          <button key={item.id} type="button" className={scenario === item.id ? "on" : ""} onClick={() => void choose(item.id)}>
            {item.label}
          </button>
        ))}
        <button type="button" onClick={() => void choose("normal")}>
          RESET
        </button>
        <button type="button" className={soundOn ? "on" : ""} onClick={toggleSound}>
          SOUND {soundOn ? "ON" : "OFF"}
        </button>
      </div>
      <p className="empty-note">
        Keys: M menu, 1 chat, 2 dashboard, 3 map, 4 alerts, P present mode, Esc closes the menu.
        Supabase is optional. Without it, vitals stay in this browser and the link reads LINK DEGRADED.
      </p>
    </section>
  );
}
