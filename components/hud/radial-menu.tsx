"use client";

import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useHud } from "@/lib/store/hud";

const ITEMS = [
  { href: "/", label: "CHAT", key: "1" },
  { href: "/dashboard", label: "DASHBOARD", key: "2" },
  { href: "/map", label: "SHIP MAP", key: "3" },
  { href: "/alerts", label: "ALERTS", key: "4" },
  { href: "/settings", label: "SETTINGS", key: "S" },
];

export function RadialMenu() {
  const open = useHud((state) => state.menuOpen);
  const toggleMenu = useHud((state) => state.toggleMenu);
  const soundOn = useHud((state) => state.soundOn);
  const router = useRouter();

  function go(href: string) {
    if (soundOn) blip();
    toggleMenu(false);
    router.push(href);
  }

  return (
    <div className="radial">
      <AnimatePresence>
        {open ? (
          <motion.nav
            className="radial-pop"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            aria-label="Orbital Medic sections"
          >
            {ITEMS.map((item) => (
              <button key={item.href} type="button" onClick={() => go(item.href)}>
                <span>{item.key}</span>
                {item.label}
              </button>
            ))}
          </motion.nav>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        className="radial-btn"
        aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => {
          if (soundOn) blip();
          toggleMenu();
        }}
      >
        M
      </button>
    </div>
  );
}

function blip() {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 440;
  gain.gain.value = 0.03;
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.06);
}
