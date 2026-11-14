# Astronaut Health Monitor

Chat-first flight-medic decision support for a crew emergency. The home screen is a conversation, not a dashboard. A crewmate describes symptoms in plain language. The medic link answers with first-aid steps, one follow-up question, and a safety disclaimer.

This is **decision support only**. It is not a diagnosis, not a licensed prescription, and not an official NASA protocol. Follow the vehicle emergency checklist and Mission Control.

Built for a NASA Space Apps-style demo. Primary case: chest pain or crewmate collapse. It also handles eye and vision complaints.

## Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

```bash
npm test
```

The unit tests cover the offline chest-pain path, vitals parsing, eye complaints, and the rule that model output cannot lower urgency or introduce a drug dose.

## Gemini

Copy `.env.example` to `.env.local` and set one key:

```bash
GEMINI_API_KEY=your_key
```

`GOOGLE_GENERATIVE_AI_API_KEY` is accepted as well. Optional override: `GEMINI_MODEL` (default `gemini-3.1-flash-lite`).

`POST /api/medic` returns the same JSON shape either way:

| Field | Meaning |
| --- | --- |
| `urgency` | `routine`, `elevated`, or `critical` |
| `assessmentSummary` | What the crew report adds up to, without a diagnosis |
| `immediateSteps` | Numbered first-aid actions |
| `vitalsNext` | What to measure or repeat |
| `redFlags` | Changes that raise the emergency |
| `environmentNotes` | Spacecraft, station, or lunar-surface constraints |
| `kitGuidance` | Educational use of manifested kit items. No doses, no controlled drugs |
| `followUpQuestion` | One missing fact, or null when the checklist is complete |
| `quickReplies` | Optional taps for that question |
| `disclaimer` | Decision-support limit |
| `source` | `gemini` or `offline` |

If the key is missing, the request fails, or the model returns an unsafe kit line, the onboard rule engine answers instead. The browser also calls that same engine if the network request itself fails. Gemini is not allowed to drop the urgency below the rule engine, and follow-up questions stay on the rule engine so the demo path does not wander.

Supabase and Vercel are optional later. The demo does not need them.

## Three-minute demo

Set the environment to **STATION**. Leave the Gemini key empty if you want the path to be deterministic.

| Time | Do this | You should see |
| --- | --- | --- |
| 0:00 | Open the app. Read the header line. | Black full-screen chat. Disclaimer is visible before any message. |
| 0:20 | Send: `sudden chest pain on station, sweaty, short of breath` | An **ELEVATED** card: call medic / Mission Control, restrain semi-upright, oxygen only if trained, no unlabeled drugs. One question: alert, voice, pain, or unresponsive. |
| 0:50 | Tap **Alert**, then **Lab module**. | Each tap asks only the next missing fact. |
| 1:20 | Send: `HR 110 RR 24 SpO2 94 pain 7` | Summary repeats those vitals. Urgency stays elevated (SpO2 94, pain 7). Next question is pressure versus sharp. |
| 1:45 | Tap **Sudden pressure**, then **Stable, continuing care**. | Steps remain on screen. The question closes. Disclaimer and `SOURCE OFFLINE RULES` (or `GEMINI`) stay on the card. |
| 2:10 | Optional: tap **CAM**, capture a still, or cancel if the browser blocks the camera. | The still is labeled as a handoff log, not a pupil measurement. The chest protocol stays in force. |
| 2:40 | Switch the header to **LUNAR BASE** and send the chest-pain line again (RESET first if you want a clean thread). | Notes mention suit seals and dust. ABC still starts before a comms reply. |

A second path, if you have time: RESET, send `left eye sudden blur and flashes`, then `chemical splash in the right eye` in a fresh thread. Blur is elevated and says not to rub. Chemical is critical and tells a trained crewmember to irrigate with manifested saline.

Try `HR 110 RR 24 SpO2 91 pain 9` on the chest path if you want to show the card turn **CRITICAL**.
