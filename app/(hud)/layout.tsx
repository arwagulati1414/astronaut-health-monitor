import type { ReactNode } from "react";
import { HudFrame } from "@/components/hud/hud-frame";

export default function HudLayout({ children }: { children: ReactNode }) {
  return <HudFrame>{children}</HudFrame>;
}
