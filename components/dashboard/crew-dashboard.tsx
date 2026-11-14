"use client";

import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { zoneById } from "@/lib/ship/zones";
import { useHud, type VitalPoint } from "@/lib/store/hud";

const RANGES = [
  { id: "recent", label: "5 MIN", count: 24 },
  { id: "session", label: "SESSION", count: 60 },
  { id: "trend", label: "TREND", count: 96 },
] as const;

export function CrewDashboard() {
  const crew = useHud((state) => state.crew);
  const selectedCrewId = useHud((state) => state.selectedCrewId);
  const selectCrew = useHud((state) => state.selectCrew);
  const vitals = useHud((state) => state.vitals);
  const environment = useHud((state) => state.environment);
  const statusFor = useHud((state) => state.statusFor);
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>("recent");
  const astronaut = crew.find((member) => member.id === selectedCrewId) ?? crew[0];
  const count = RANGES.find((item) => item.id === range)?.count ?? 24;
  const series = (vitals[astronaut.id] ?? []).slice(-count);
  const last = series.at(-1);
  const prev = series.at(-2);

  return (
    <section className="overlay-panel dash">
      <header className="dash-head">
        <div>
          <p className="kicker">CREW VITALS</p>
          <h2>{astronaut.callsign}</h2>
          <p>
            {astronaut.fullName} · {astronaut.role.replaceAll("_", " ")} ·{" "}
            {zoneById(astronaut.zoneId)?.label ?? "UNKNOWN"}
          </p>
        </div>
        <strong className={`status status-${statusFor(astronaut.id).toLowerCase()}`}>
          {statusFor(astronaut.id)}
        </strong>
      </header>
      <div className="crew-tabs">
        {crew.map((member) => (
          <button
            key={member.id}
            type="button"
            className={member.id === astronaut.id ? "on" : ""}
            onClick={() => selectCrew(member.id)}
          >
            <b>{member.callsign}</b>
            <span className={`status-dot status-${statusFor(member.id).toLowerCase()}`} />
          </button>
        ))}
      </div>
      <div className="readouts">
        <Readout label="HR" value={last ? String(last.heartRate) : "—"} unit="bpm" trend={trend(last?.heartRate, prev?.heartRate)} />
        <Readout label="SPO2" value={last ? String(last.spo2) : "—"} unit="%" trend={trend(last?.spo2, prev?.spo2)} />
        <Readout
          label="BP"
          value={last ? `${last.bpSys}/${last.bpDia}` : "—"}
          unit="mmHg"
          trend={trend(last?.bpSys, prev?.bpSys)}
        />
        <Readout label="RR" value={last ? String(last.respRate) : "—"} unit="/min" trend={trend(last?.respRate, prev?.respRate)} />
        <Readout label="TEMP" value={last ? last.tempC.toFixed(1) : "—"} unit="C" trend={trend(last?.tempC, prev?.tempC)} />
      </div>
      <div className="range-row">
        {RANGES.map((item) => (
          <button key={item.id} type="button" className={range === item.id ? "on" : ""} onClick={() => setRange(item.id)}>
            {item.label}
          </button>
        ))}
        <span>Live demo buffer. Missing archive is not filled in.</span>
      </div>
      <div className="chart-box">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={series}>
            <CartesianGrid stroke="#661111" />
            <XAxis dataKey="t" hide />
            <YAxis stroke="#cfcfcf" width={36} />
            <Tooltip contentStyle={{ background: "#000", border: "1px solid #ff1a1a", borderRadius: 0 }} />
            <Line type="monotone" dataKey="heartRate" stroke="#ff1a1a" dot={false} strokeWidth={2.4} />
            <Line type="monotone" dataKey="spo2" stroke="#cfcfcf" dot={false} strokeWidth={1.4} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="env-grid">
        <Env label="O2" value={`${environment.o2.toFixed(1)}%`} />
        <Env label="CO2" value={`${Math.round(environment.co2)} ppm`} />
        <Env label="PRESS" value={`${environment.pressure.toFixed(1)} kPa`} />
        <Env label="CABIN" value={`${environment.temp.toFixed(1)} C`} />
        <Env label="RAD" value={`${environment.radiation.toFixed(2)} mSv/h`} />
        <Env label="HUM" value={`${Math.round(environment.humidity)}%`} />
      </div>
    </section>
  );
}

function Readout({ label, value, unit, trend }: { label: string; value: string; unit: string; trend: string }) {
  return (
    <div className="readout">
      <span>{label}</span>
      <strong>
        {value}
        <small>{trend}</small>
      </strong>
      <em>{unit}</em>
    </div>
  );
}

function Env({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function trend(current?: number, previous?: number): string {
  if (current == null || previous == null) return "";
  if (current > previous) return " ↑";
  if (current < previous) return " ↓";
  return " →";
}

export type { VitalPoint };
