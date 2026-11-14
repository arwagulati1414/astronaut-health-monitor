"use client";

import { zoneById } from "@/lib/ship/zones";
import { useHud } from "@/lib/store/hud";

export function AlertsView() {
  const alerts = useHud((state) => state.alerts);
  const crew = useHud((state) => state.crew);
  const setAlertStatus = useHud((state) => state.setAlertStatus);

  return (
    <section className="overlay-panel">
      <p className="kicker">THRESHOLD BREACHES</p>
      <h2>ALERTS</h2>
      {alerts.length === 0 ? <p className="empty-note">No open events. Nominal, or the simulator has not crossed a threshold.</p> : null}
      <ul className="alert-list">
        {alerts.map((alert) => {
          const member = crew.find((item) => item.id === alert.astronautId);
          return (
            <li key={alert.id} className={`alert-row alert-${alert.severity}`}>
              <div>
                <strong>{alert.severity.toUpperCase()}</strong>
                <p>{alert.message}</p>
                <span>
                  {member?.callsign ?? "SHIP"} · {zoneById(alert.zoneId)?.label ?? "UNASSIGNED"} ·{" "}
                  {new Date(alert.createdAt).toLocaleTimeString()}
                </span>
              </div>
              <div className="alert-actions">
                <button type="button" onClick={() => setAlertStatus(alert.id, "acknowledged")}>
                  ACK
                </button>
                <button type="button" onClick={() => setAlertStatus(alert.id, "resolved")}>
                  RESOLVE
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
