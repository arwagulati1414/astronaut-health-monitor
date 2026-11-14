import { CREW } from "../lib/vitals/crew";
import { stepToward } from "../lib/vitals/thresholds";

const sample = CREW[0];
const heartRate = Math.round(stepToward(sample.baselineHr, sample.baselineHr, 3, 1));

console.log(
  `${sample.callsign} sample HR ${heartRate}. The stage demo runs in Settings and does not need this script.`,
);

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.log("Supabase is not configured. The browser keeps the live demo buffer.");
}
