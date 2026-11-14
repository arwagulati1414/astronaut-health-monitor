"use client";

import dynamic from "next/dynamic";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { RadialMenu } from "@/components/hud/radial-menu";
import { useHud } from "@/lib/store/hud";
import { zoneById } from "@/lib/ship/zones";
import { browserSupabase } from "@/lib/supabase/client";

const ShipScene = dynamic(
  () => import("@/components/ship/ship-scene").then((mod) => mod.ShipScene),
  { ssr: false },
);

const BOOT_LINES = [
  "INITIALIZING LIFE SUPPORT",
  "LINKING CREW TELEMETRY",
  "SHIP BLUEPRINT LOCKED",
  "ORBITAL MEDIC ONLINE",
];

export function HudFrame({ children }: { children: ReactNode }) {
  const bootDone = useHud((state) => state.bootDone);
  const finishBoot = useHud((state) => state.finishBoot);
  const presentMode = useHud((state) => state.presentMode);
  const togglePresent = useHud((state) => state.togglePresent);
  const menuOpen = useHud((state) => state.menuOpen);
  const toggleMenu = useHud((state) => state.toggleMenu);
  const tick = useHud((state) => state.tick);
  const selectCrew = useHud((state) => state.selectCrew);
  const crew = useHud((state) => state.crew);
  const toast = useHud((state) => state.toast);
  const dismissToast = useHud((state) => state.dismissToast);
  const [line, setLine] = useState(0);
  const [intro, setIntro] = useState(false);
  const [linked, setLinked] = useState(true);
  const activeZoneId = useHud((state) => state.activeZoneId);
  const crewHere = crew.filter((member) => member.zoneId === activeZoneId).map((member) => member.callsign);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setLinked(Boolean(browserSupabase()));
    const timer = window.setInterval(() => tick(), 1500);
    return () => window.clearInterval(timer);
  }, [tick]);

  useEffect(() => {
    if (bootDone) return;
    if (line >= BOOT_LINES.length) {
      const done = window.setTimeout(() => finishBoot(), 400);
      return () => window.clearTimeout(done);
    }
    const next = window.setTimeout(() => setLine((value) => value + 1), 420);
    return () => window.clearTimeout(next);
  }, [bootDone, finishBoot, line]);

  useEffect(() => {
    setIntro(!window.localStorage.getItem("orbital-medic-intro"));
  }, []);

  useEffect(() => {
    if (!presentMode) return;
    const timer = window.setInterval(() => {
      const ids = useHud.getState().crew.map((member) => member.id);
      const current = useHud.getState().selectedCrewId;
      const next = ids[(ids.indexOf(current) + 1) % ids.length];
      selectCrew(next);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [presentMode, selectCrew]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "TEXTAREA" || target.tagName === "INPUT")) return;
      if (event.key === "m" || event.key === "M") toggleMenu();
      if (event.key === "Escape") toggleMenu(false);
      if (event.key === "p" || event.key === "P") togglePresent();
      if (event.key === "1") router.push("/");
      if (event.key === "2") router.push("/dashboard");
      if (event.key === "3") router.push("/map");
      if (event.key === "4") router.push("/alerts");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, toggleMenu, togglePresent]);

  return (
    <div className={presentMode ? "hud-root present" : "hud-root"}>
      <div className="scanlines" />
      <div className="hud-world" aria-hidden={pathname !== "/map"}>
        <ShipScene />
      </div>
      <header className="hud-bar">
        <div>
          <p className="kicker">ARES-7 · NO ONBOARD PHYSICIAN</p>
          <strong>ORBITAL MEDIC</strong>
        </div>
        <p className={linked ? "link-ok" : "link-bad"}>{linked ? "UPLINK LIVE" : "LINK DEGRADED · DEMO BUFFER"}</p>
      </header>
      <main className="hud-stage">{children}</main>
      {activeZoneId ? (
        <p className="zone-float">
          {zoneById(activeZoneId)?.label ?? activeZoneId}
          {crewHere.length ? ` · ${crewHere.join(" ")}` : ""}
        </p>
      ) : null}
      <footer className="hud-foot">DECISION SUPPORT ONLY — NOT A DIAGNOSTIC TOOL</footer>
      <RadialMenu />
      {toast ? (
        <button type="button" className="toast" onClick={() => { dismissToast(); router.push("/"); }}>
          {toast}
          <span>OPEN ASSISTANT</span>
        </button>
      ) : null}
      <AnimatePresence>
        {!bootDone ? (
          <motion.div className="boot" initial={{ opacity: 1 }} exit={{ opacity: 0 }}>
            {BOOT_LINES.slice(0, line).map((text) => (
              <p key={text}>{text}</p>
            ))}
            <p className="cursor">_</p>
          </motion.div>
        ) : null}
      </AnimatePresence>
      {intro && bootDone ? (
        <div className="modal" role="dialog" aria-labelledby="intro-title">
          <div className="modal-card">
            <p className="kicker">READ THIS FIRST</p>
            <h2 id="intro-title">This is not a diagnosis.</h2>
            <p>
              Orbital Medic helps the crew decide what to do next. It does not replace a flight surgeon,
              a vehicle checklist, or ground control. Live numbers on this demo are a simulator unless a
              Supabase link is configured.
            </p>
            <button
              type="button"
              onClick={() => {
                window.localStorage.setItem("orbital-medic-intro", "1");
                setIntro(false);
              }}
            >
              ACKNOWLEDGE
            </button>
          </div>
        </div>
      ) : null}
      <span className="sr-only">{crew.length} crew tracked</span>
    </div>
  );
}
