export type NasaRisk = {
  id: string;
  title: string;
  url: string;
  note: string;
};

/** Official NASA Human Research Roadmap risk pages used as context, not as a treatment protocol. */
export const NASA_RISKS: NasaRisk[] = [
  {
    id: "cardiovascular",
    title: "Risk of Cardiovascular Adaptations",
    url: "https://humanresearchroadmap.nasa.gov/Risks/risk.aspx?i=179",
    note: "NASA lists heart-rhythm changes, orthostatic intolerance, and later cardiovascular disease as a spaceflight risk. This monitor records heart rate, oxygen, breathing, and blood pressure so a crewmate can describe a change. The first-aid steps are not a NASA protocol.",
  },
  {
    id: "sans",
    title: "Risk of Spaceflight Associated Neuro-ocular Syndrome",
    url: "https://humanresearchroadmap.nasa.gov/risks/risk.aspx?i=105",
    note: "NASA reports that most long-duration crewmembers show at least one SANS sign, including optic-disc swelling, folds, globe flattening, or a shift in focus. A vision complaint is a reason to protect the eye and tell Mission Control. A camera still is not a SANS measurement.",
  },
];

export const NASA_ROADMAP = {
  title: "NASA Human Research Roadmap",
  url: "https://humanresearchroadmap.nasa.gov/",
};

const CARDIO =
  /\b(chest|heart|cardiac|hr\b|heart rate|pulse|spo2|sp02|oxygen|blood pressure|\bbp\b|short of breath|shortness of breath|collapse|collapsed|dizzy|dizziness|syncope|sweaty)\b/i;
const EYE =
  /\b(eye|eyes|vision|visual|blur|blurry|flashes|pupil|sans|sight)\b/i;

export function nasaContextFor(text: string): NasaRisk[] {
  const matches: NasaRisk[] = [];
  if (CARDIO.test(text)) matches.push(NASA_RISKS[0]);
  if (EYE.test(text)) matches.push(NASA_RISKS[1]);
  return matches;
}
