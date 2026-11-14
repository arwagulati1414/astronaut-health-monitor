import { DISCLAIMER, type Environment, type HistoryTurn, type MedicReply, type MedicRequest, type Urgency, type Vitals } from "./types";
import { kitIsUnsafe, maxUrgency } from "./reconcile";

const PLACE =
  /\b(cupola|airlock|node(?:\s*\d)?|lab(?:oratory)?(?:\s+module)?|galley|crew quarters|sleep station|cockpit|flight deck|cabin|middeck|habitat|rover|suitlock|wardroom|destiny|harmony|unity|columbus|kibo|quest)\b/i;

const EYE_LOG_NOTE =
  "An eye still was captured in this session as a handoff log. It is experimental. It is not a pupil measurement, a vision test, or a diagnosis.";

export function parseVitals(text: string): Vitals {
  const hr = text.match(/\b(?:hr|heart\s*rate|pulse)\s*[:=]?\s*(\d{2,3})\b/i);
  const rr = text.match(/\b(?:rr|resp(?:iratory)?\s*rate)\s*[:=]?\s*(\d{1,2})\b/i);
  const spo2 = text.match(
    /\b(?:spo2|sp02|o2\s*sat|oxygen\s*sat(?:uration)?|sat)\s*[:=]?\s*(\d{2,3})\s*%?/i,
  );
  const pain = text.match(/\bpain\s*[:=]?\s*(\d{1,2})(?:\s*\/\s*10)?\b/i);
  const bp = text.match(/\b(?:bp|blood\s*pressure)\s*[:=]?\s*(\d{2,3})\s*\/\s*(\d{2,3})\b/i);

  return {
    hr: hr ? Number(hr[1]) : null,
    rr: rr ? Number(rr[1]) : null,
    spo2: spo2 ? Number(spo2[1]) : null,
    pain: pain ? Number(pain[1]) : null,
    bpSys: bp ? Number(bp[1]) : null,
    bpDia: bp ? Number(bp[2]) : null,
  };
}

export function adviseOffline(request: MedicRequest): MedicReply {
  const history = request.history ?? [];
  const text = history
    .filter((turn) => turn.role === "user")
    .map((turn) => turn.content)
    .join("\n");
  const eyeHandoff =
    Boolean(request.eyeHandoffLogged) || /eye handoff log/i.test(text);
  const scenario = classify(text);

  const reply =
    scenario === "cardiac"
      ? cardiacReply(request.environment, text, history)
      : scenario === "eye"
        ? eyeReply(request.environment, text, history)
        : generalReply(request.environment, text, history);

  if (eyeHandoff) {
    reply.environmentNotes = [...reply.environmentNotes, EYE_LOG_NOTE];
  }
  if (kitIsUnsafe(reply.kitGuidance)) {
    reply.kitGuidance = safeSharedKit();
  }
  reply.disclaimer = DISCLAIMER;
  reply.source = "offline";
  return reply;
}

function classify(text: string): "cardiac" | "eye" | "general" {
  const strongCardiac =
    /\b(chest pain|chest tightness|chest pressure|collapse[d]?|collapsed|unresponsive|heart attack|syncope)\b/i;
  const cardiac =
    /\b(crushing pain|angina|short of breath|shortness of breath|can(?:not|'t) breathe|diaphoretic|sweaty|clammy)\b/i;
  const eye =
    /\b(eye|eyes|vision|visual|pupil|pupils|blur|blurry|flashes|floaters|double vision|blind|blindness)\b/i;

  if (strongCardiac.test(text)) return "cardiac";
  if (eye.test(text) && !cardiac.test(text)) return "eye";
  if (cardiac.test(text)) return "cardiac";
  if (eye.test(text)) return "eye";
  return "general";
}

function cardiacReply(
  environment: Environment,
  text: string,
  history: HistoryTurn[],
): MedicReply {
  const avpu = resolveAvpu(history);
  const location = resolveLocation(text, history);
  const vitals = parseVitals(text);
  const follow = cardiacFollowUp(text, history, avpu, location, vitals);
  let urgency = cardiacUrgency(text, avpu.value, vitals);
  const latest = latestUser(history);
  if (
    /worse|pain increasing|saturation dropping|collapsed\s*\/\s*unresponsive/i.test(
      latest,
    )
  ) {
    urgency = "critical";
  }

  const conscious = avpu.value === "A" || avpu.value === "V";
  const down = avpu.value === "U" || avpu.value === "P" || urgency === "critical";

  return {
    urgency,
    assessmentSummary: cardiacSummary(text, avpu, location, vitals, urgency),
    immediateSteps: down && !conscious ? unconsciousSteps() : consciousChestSteps(),
    vitalsNext: vitalsChecklist(vitals),
    redFlags: [
      "Becomes unresponsive, or stops answering.",
      "Breathing turns to gasping, becomes very fast, or stops.",
      "Oxygen saturation falls below 92% or keeps dropping.",
      "Pain spreads, suddenly worsens, or they vomit.",
      "No pulse, a seizure, new confusion, or blue or gray skin.",
    ],
    environmentNotes: environmentNotes(environment, "cardiac"),
    kitGuidance: [
      "Supplemental oxygen from the manifested medical kit, and only if you are trained to use it.",
      "Pulse oximeter and blood pressure cuff if they are manifested. Record the numbers. The device is not a diagnosis.",
      "Use a manifested defibrillator only if this crew is trained and the vehicle checklist says to.",
      "Use a restraint so the crewmate cannot drift.",
      "Do not give food, drink, or unlabeled medication.",
      "Aspirin only if it is in the approved kit and Mission Control or the onboard medic directs it. This app will not give a dose.",
    ],
    followUpQuestion: follow?.question ?? null,
    quickReplies: follow?.quickReplies,
    disclaimer: DISCLAIMER,
    source: "offline",
    slot: follow?.slot ?? null,
  };
}

function eyeReply(
  environment: Environment,
  text: string,
  history: HistoryTurn[],
): MedicReply {
  const which = resolveEyeWhich(text, history);
  const mechanism = resolveEyeMechanism(text, history);
  const severity = resolveEyeSeverity(text, history);
  const follow = eyeFollowUp(history, which, mechanism, severity);
  let urgency = eyeUrgency(text, mechanism, severity);
  if (/worse|cannot see|can't see|still burning/i.test(latestUser(history))) {
    urgency = maxUrgency(urgency, "critical");
  }

  return {
    urgency,
    assessmentSummary: eyeSummary(which, mechanism, severity, urgency),
    immediateSteps: eyeSteps(mechanism),
    vitalsNext: [
      "Which eye, and whether vision is normal, blurry, light-only, or gone.",
      "Pain 0–10, and whether it is burning, aching, or a foreign-body sensation.",
      "Describe the pupil in plain words for the medic. Do not treat that description as a measurement.",
      "Note nausea, headache, or a new change since the last check.",
    ],
    redFlags: [
      "Vision suddenly drops or the eye goes dark.",
      "Chemical is still in the eye, or irrigation has not started.",
      "Something is stuck in the eye. Do not pull it out.",
      "Blood in the eye, severe pain, or an irregular pupil you can describe to the medic.",
      "Both eyes are involved, or vision changes come with headache or vomiting.",
    ],
    environmentNotes: environmentNotes(environment, "eye"),
    kitGuidance: [
      "Sterile saline or manifested eye-wash for irrigation if you are trained and the checklist agrees.",
      "A rigid eye shield for trauma. Do not press on the eye.",
      "No unlabeled drops, no steroid drops, and no numbing drops unless Mission Control directs a manifested item.",
      "Camera stills are handoff logs, not instruments.",
    ],
    followUpQuestion: follow?.question ?? null,
    quickReplies: follow?.quickReplies,
    disclaimer: DISCLAIMER,
    source: "offline",
    slot: follow?.slot ?? null,
  };
}

function generalReply(
  environment: Environment,
  text: string,
  history: HistoryTurn[],
): MedicReply {
  const severe =
    /\b(heavy bleeding|bleeding heavily|seizure|anaphyla|throat (?:is )?clos|decompression|hypoxia|not breathing|unconscious)\b/i.test(
      text,
    );
  const follow = answersAfter(history, "chief").length
    ? null
    : {
        slot: "chief" as const,
        question:
          "What is the main problem right now: breathing, chest pain, bleeding, vision, or something else?",
        quickReplies: ["Breathing", "Chest pain", "Bleeding", "Vision", "Other"],
      };

  return {
    urgency: severe ? "critical" : "routine",
    assessmentSummary: severe
      ? "The report includes a time-critical warning sign. Treat airway, breathing, and circulation as the priority and get Mission Control and the onboard medic on the loop now. This is decision support, not a diagnosis."
      : "The report does not yet name a specific emergency pattern. Stay with the crewmate, check airway, breathing, and circulation, and describe the main problem in the next message. This is decision support, not a diagnosis.",
    immediateSteps: [
      "Pause the task. Restrain yourself and the crewmate so nobody drifts into equipment.",
      "Check airway, breathing, and circulation. If they are unresponsive and not breathing normally, start crew CPR as the vehicle checklist directs and send someone for a manifested defibrillator.",
      "Call the onboard medic and Mission Control. Give one sentence: what happened, where you are, and whether the crewmate is alert.",
      "Do not give unlabeled medication, food, or drink.",
      "If this becomes chest pain, collapse, heavy bleeding, trouble breathing, a seizure, or a chemical in the eye, say that next and keep first aid going while you wait for comms.",
    ],
    vitalsNext: [
      "Are they alert, responding to voice, responding to pain, or unresponsive?",
      "Breathing: normal, labored, gasping, or absent.",
      "Heart rate if you can feel a pulse.",
      "Any bleeding, pain 0–10, or vision change.",
    ],
    redFlags: [
      "Unresponsive, or not breathing normally.",
      "Heavy bleeding, seizure, or swelling of the tongue or throat.",
      "Chest pain, sudden shortness of breath, or collapse.",
      "Chemical in the eye, or sudden loss of vision.",
    ],
    environmentNotes: environmentNotes(environment, "general"),
    kitGuidance: safeSharedKit(),
    followUpQuestion: follow?.question ?? null,
    quickReplies: follow?.quickReplies,
    disclaimer: DISCLAIMER,
    source: "offline",
    slot: follow?.slot ?? null,
  };
}

function cardiacFollowUp(
  text: string,
  history: HistoryTurn[],
  avpu: { status: "missing" | "known"; value: Avpu | "unknown" },
  location: string | null,
  vitals: Vitals,
): { slot: MedicReply["slot"]; question: string; quickReplies: string[] } | null {
  if (avpu.status === "missing") {
    return {
      slot: "avpu",
      question:
        "Is the crewmate alert, responding to voice, responding to pain, or unresponsive?",
      quickReplies: ["Alert", "Voice", "Pain", "Unresponsive"],
    };
  }
  if (!location) {
    return {
      slot: "location",
      question: "Where on the vehicle is the crewmate right now?",
      quickReplies: ["Lab module", "Airlock", "Crew quarters", "Other — I'll type it"],
    };
  }
  const vitalsKnown =
    hasVitals(vitals) ||
    answersAfter(history, "vitals").length > 0 ||
    /no vitals|vitals unavailable|not available|cannot measure|can't measure/i.test(text);
  if (!vitalsKnown) {
    return {
      slot: "vitals",
      question:
        "Can you report heart rate, respiratory rate, SpO2, and pain from 0 to 10? Example format: HR 110 RR 24 SpO2 94 pain 7.",
      quickReplies: ["No vitals available"],
    };
  }
  if (!characterKnown(text, history)) {
    const sudden = /\b(sudden|acute|gradual)\b/i.test(text);
    return {
      slot: "character",
      question: sudden
        ? "Does the pain feel like pressure or tightness, or is it sharp?"
        : "Did this start suddenly, and is the pain pressure-like or sharp?",
      quickReplies: ["Sudden pressure", "Sudden sharp", "Gradual / mild", "Unknown"],
    };
  }
  if (/stable,\s*continuing care/i.test(latestUser(history))) return null;
  return {
    slot: "status",
    question:
      "Any new red flag since the last check — worse pain, collapse, or oxygen saturation dropping?",
    quickReplies: [
      "Stable, continuing care",
      "Worse — pain increasing",
      "Collapsed / unresponsive",
    ],
  };
}

function eyeFollowUp(
  history: HistoryTurn[],
  which: string | null,
  mechanism: string | null,
  severity: string | null,
): { slot: MedicReply["slot"]; question: string; quickReplies: string[] } | null {
  if (!which) {
    return {
      slot: "eye-which",
      question: "Which eye is involved?",
      quickReplies: ["Left", "Right", "Both", "Not sure"],
    };
  }
  if (!mechanism) {
    return {
      slot: "eye-mechanism",
      question:
        "Was there a chemical, dust, or an impact, or is this a vision change without injury?",
      quickReplies: [
        "Chemical / dust",
        "Trauma / impact",
        "Vision change only",
        "Irritation only",
      ],
    };
  }
  if (!severity) {
    return {
      slot: "eye-severity",
      question: "What can they see with the affected eye right now?",
      quickReplies: ["Sees normally", "Blurry", "Light only / cannot see"],
    };
  }
  if (/stable,\s*continuing care/i.test(latestUser(history))) return null;
  return {
    slot: "status",
    question:
      "Since the last check, is vision worse, the same, or is a chemical still in the eye?",
    quickReplies: ["Stable, continuing care", "Vision worse", "Chemical still in the eye"],
  };
}

type Avpu = "A" | "V" | "P" | "U";

function resolveAvpu(history: HistoryTurn[]): {
  status: "missing" | "known";
  value: Avpu | "unknown";
} {
  const users = history.filter((turn) => turn.role === "user");
  for (let i = users.length - 1; i >= 0; i -= 1) {
    const parsed = parseAvpuMessage(users[i].content);
    if (parsed) return { status: "known", value: parsed };
  }
  if (answersAfter(history, "avpu").length > 0) {
    return { status: "known", value: "unknown" };
  }
  return { status: "missing", value: "unknown" };
}

function parseAvpuMessage(content: string): Avpu | null {
  const text = content.trim();
  if (
    /\bunresponsive\b|\bunconscious\b|\bno response\b|\bnot alert\b/i.test(text)
  ) {
    return "U";
  }
  if (
    /^pain$/i.test(text) ||
    /\bresponds to pain\b|\bresponding to pain\b|\bavpu\s*[:=]?\s*p\b/i.test(text)
  ) {
    return "P";
  }
  if (
    /^voice$/i.test(text) ||
    /\bresponds to voice\b|\bresponding to voice\b|\bavpu\s*[:=]?\s*v\b/i.test(text)
  ) {
    return "V";
  }
  if (
    /^alert$/i.test(text) ||
    /\bconscious\b|\bawake\b|\bavpu\s*[:=]?\s*a\b/i.test(text) ||
    /\balert\b/i.test(text)
  ) {
    return "A";
  }
  return null;
}

function resolveLocation(text: string, history: HistoryTurn[]): string | null {
  const place = text.match(PLACE);
  if (place) return place[0];
  const answers = answersAfter(history, "location");
  if (answers.length === 0) return null;
  return answers[answers.length - 1];
}

function characterKnown(text: string, history: HistoryTurn[]): boolean {
  if (
    /sudden pressure|pressure-like|crushing|tightness|chest pressure|sudden sharp|sharp pain|gradual\s*\/\s*mild|\bgradual\b|\bunknown\b|\bnot sure\b/i.test(
      text,
    )
  ) {
    return true;
  }
  return answersAfter(history, "character").length > 0;
}

function resolveEyeWhich(text: string, history: HistoryTurn[]): string | null {
  if (/\bboth eyes\b|\bbilateral\b|^both$/im.test(text)) return "both";
  if (/\bleft eye\b|^left$/im.test(text)) return "left";
  if (/\bright eye\b|^right$/im.test(text)) return "right";
  if (/^not sure$/im.test(text)) return "not sure";
  const answers = answersAfter(history, "eye-which");
  return answers.length ? answers[answers.length - 1] : null;
}

function resolveEyeMechanism(text: string, history: HistoryTurn[]): string | null {
  if (/chemical|splash|solvent|fuel|acid|alkali/i.test(text)) return "chemical";
  if (/dust|particle|foreign body|debris|grit|chemical \/ dust/i.test(text)) return "dust";
  if (/trauma|impact|blunt|poked|penetrat|stuck in the eye|trauma \/ impact/i.test(text)) {
    return "trauma";
  }
  if (/vision change only|without injury/i.test(text)) return "visual";
  if (/irritation only|mild irritation/i.test(text)) return "irritation";
  const answers = answersAfter(history, "eye-mechanism");
  if (!answers.length) return null;
  return resolveEyeMechanism(answers[answers.length - 1], []) ?? "reported";
}

function resolveEyeSeverity(text: string, history: HistoryTurn[]): string | null {
  if (/cannot see|can't see|blind|light only|vision loss|went dark|no light/i.test(text)) {
    return "severe";
  }
  if (/\bblur/i.test(text)) return "blur";
  if (/sees normally|see normally|normal vision/i.test(text)) return "normal";
  const answers = answersAfter(history, "eye-severity");
  return answers.length ? answers[answers.length - 1] : null;
}

function cardiacUrgency(
  text: string,
  avpu: Avpu | "unknown",
  vitals: Vitals,
): Urgency {
  let urgency: Urgency = "elevated";
  if (avpu === "U" || avpu === "P") urgency = "critical";
  if (
    /\b(collapsed|collapse|no pulse|not breathing|gasping|cyanotic|blue lips|seizure)\b/i.test(
      text,
    )
  ) {
    urgency = "critical";
  }
  if (vitals.spo2 != null && vitals.spo2 < 92) urgency = "critical";
  if (vitals.pain != null && vitals.pain >= 8) urgency = "critical";
  if (vitals.hr != null && (vitals.hr >= 150 || vitals.hr < 40)) urgency = "critical";
  if (vitals.rr != null && vitals.rr >= 30) urgency = "critical";
  if (vitals.bpSys != null && vitals.bpSys < 90) urgency = "critical";
  if (vitals.spo2 != null && vitals.spo2 < 95) urgency = maxUrgency(urgency, "elevated");
  if (vitals.hr != null && (vitals.hr >= 110 || vitals.hr < 50)) {
    urgency = maxUrgency(urgency, "elevated");
  }
  if (vitals.rr != null && vitals.rr >= 22) urgency = maxUrgency(urgency, "elevated");
  return urgency;
}

function eyeUrgency(
  text: string,
  mechanism: string | null,
  severity: string | null,
): Urgency {
  if (mechanism === "chemical" || mechanism === "trauma" || severity === "severe") {
    return "critical";
  }
  if (
    mechanism === "dust" ||
    /\b(flash|flashes|floater|floaters|double vision|blur)\b/i.test(text)
  ) {
    return "elevated";
  }
  if (mechanism === "irritation") return "routine";
  return "elevated";
}

function cardiacSummary(
  text: string,
  avpu: { value: Avpu | "unknown"; status: string },
  location: string | null,
  vitals: Vitals,
  urgency: Urgency,
): string {
  const features: string[] = [];
  if (/\bsudden\b/i.test(text)) features.push("sudden onset");
  if (/\bsweaty\b|\bclammy\b|\bdiaphore/i.test(text)) features.push("sweating");
  if (/short of breath|shortness of breath|can't breathe|cannot breathe/i.test(text)) {
    features.push("shortness of breath");
  }
  const pattern = features.length
    ? `Chest-pain report with ${features.join(", ")}.`
    : "Chest-pain or collapse report.";
  const avpuText =
    avpu.value === "A"
      ? "Alert"
      : avpu.value === "V"
        ? "responds to voice"
        : avpu.value === "P"
          ? "responds to pain"
          : avpu.value === "U"
            ? "unresponsive"
        : avpu.status === "known"
          ? "unclear"
          : "not yet reported";
  const level =
    urgency === "critical"
      ? "Treat this as a time-critical emergency now."
      : "Treat chest pain in space as time-critical until Mission Control or the onboard medic clears it.";
  return `${pattern} Consciousness: ${avpuText}. Location: ${location ?? "not yet reported"}. Vitals: ${formatVitals(vitals)}. ${level} This is decision support, not a diagnosis.`;
}

function eyeSummary(
  which: string | null,
  mechanism: string | null,
  severity: string | null,
  urgency: Urgency,
): string {
  const level =
    urgency === "critical"
      ? "Treat this as time-critical and start the relevant first aid now."
      : "Keep the crewmate restrained, protect the eye, and update Mission Control.";
  return `Eye or vision report. Eye: ${which ?? "not yet reported"}. Mechanism: ${mechanism ?? "not yet reported"}. Vision: ${severity ?? "not yet reported"}. ${level} Describing what you see is a handoff, not a clinical measurement. This is decision support, not a diagnosis.`;
}

function consciousChestSteps(): string[] {
  return [
    "Stop the task. Call the crew medic and Mission Control with a one-line report: chest pain, whether they are conscious, where they are, and any vitals you already have.",
    "Restrain them in a supported semi-upright posture so breathing is easier and they cannot drift. Loosen anything that restricts the chest.",
    "Watch airway and breathing. If breathing is labored, give supplemental oxygen from the vehicle medical kit only if you are trained and the checklist allows it.",
    "Note pulse and skin (sweaty, pale, or cool). If they become unresponsive and stop breathing normally, switch to crew CPR as the vehicle checklist directs.",
    "Keep them still. Do not give unlabeled drugs. Aspirin only if it is in the approved kit and Mission Control or the onboard medic directs it.",
    "Stay with them. Send an update if pain, breathing, or alertness changes. Do not wait on a comms delay before starting these steps.",
  ];
}

function unconsciousSteps(): string[] {
  return [
    "Shout for crew and open the emergency loop to Mission Control and the onboard medic. Say that a crewmate is down, name the module, and say you are starting ABC.",
    "Restrain the crewmate so they cannot drift. Open the airway the way your vehicle checklist trains.",
    "Look and listen for breathing for up to 10 seconds. If breathing is absent or only gasping, start crew CPR exactly as the vehicle emergency checklist directs and send someone for the manifested defibrillator.",
    "If they are breathing, keep the airway open and give supplemental oxygen from the medical kit only if you are trained.",
    "Do not give food, drink, or unlabeled medication. Do not delay ABC for a reply from the ground.",
    "Recheck every minute and update Mission Control when consciousness, breathing, or pulse changes.",
  ];
}

function eyeSteps(mechanism: string | null): string[] {
  const irrigation =
    mechanism === "chemical" || mechanism === "dust"
      ? "Chemical or particles: if you are trained, start irrigation with sterile saline or clean water from the medical kit and continue until Mission Control tells you to stop. Keep runoff out of the other eye."
      : "If a chemical or particle exposure becomes apparent, start trained irrigation with manifested sterile saline and tell Mission Control. Until then, do not put fluids or drops in the eye.";
  return [
    "Stop work and restrain the crewmate. Tell Mission Control and the onboard medic which eye and what happened.",
    "Do not rub the eye. Do not use unlabeled drops, ointments, or a pressure patch.",
    irrigation,
    "If there was an impact, shield the eye with a rigid shield if one is manifested. Do not press on the globe. Do not pull out an object that is stuck.",
    "Sudden vision loss, severe pain, or chemical exposure is time-critical. Start the safe step you are trained for and call for help. Do not wait out a comms delay.",
    "If you use the eye camera, the still is only a handoff log for the medic. It does not measure the pupil.",
  ];
}

function vitalsChecklist(vitals: Vitals): string[] {
  return [
    vitals.hr == null ? "Heart rate, if you can feel a pulse." : `Heart rate last reported: ${vitals.hr}. Repeat it on the next check.`,
    vitals.rr == null ? "Respiratory rate, counted for 30 seconds if you can." : `Respiratory rate last reported: ${vitals.rr}. Repeat it if breathing changes.`,
    vitals.spo2 == null
      ? "Oxygen saturation if a pulse oximeter is manifested."
      : `SpO2 last reported: ${vitals.spo2}%. Repeat it. A falling number is a red flag.`,
    vitals.pain == null ? "Pain from 0 to 10, if they can answer." : `Pain last reported: ${vitals.pain}/10. Ask again if it changes.`,
    "AVPU at every recheck: alert, voice, pain, or unresponsive.",
    "Blood pressure if a cuff is manifested and it does not delay ABC.",
  ];
}

function environmentNotes(
  environment: Environment,
  kind: "cardiac" | "eye" | "general",
): string[] {
  if (environment === "spacecraft") {
    return [
      "Volume is tight. Stow loose items and keep the airway path clear.",
      "Restrain the crewmate before you lean over them so a bump does not send either of you into a panel.",
      "Start first aid now. Send a short report when the link allows. Do not wait out a comms delay before ABC.",
      kind === "eye"
        ? "Irrigation water has to be contained. Use a towel or waste bag so free water does not migrate into equipment."
        : "Keep a crewmate on the comms loop while another stays hands-on with the patient.",
    ];
  }
  if (environment === "lunar-surface") {
    return [
      "If this is an EVA, suit integrity and air come first. Abort toward the airlock before a detailed exam.",
      "Do not break a suit seal outside. Lunar dust contaminates eyes and airways.",
      "Inside the habitat, still restrain the crewmate. Evacuation is slow, so early Mission Control notification matters.",
      kind === "cardiac"
        ? "One-sixth gravity does not make chest pain routine. Treat it as time-critical."
        : "For an eye exposed to dust, irrigate only after you are inside and the suit is off, using manifested saline.",
    ];
  }
  return [
    "Call the onboard crew medical officer and Mission Control on the emergency loop.",
    "Restrain the crewmate to a translation path or a medical restraint if one is manifested.",
    "Use the station medical-kit location on your cue card. Do not leave the crewmate alone.",
    "Another crewmate should run comms while you stay with the patient.",
  ];
}

function safeSharedKit(): string[] {
  return [
    "Use only items on the vehicle medical-kit manifest, and only the way your checklist trains.",
    "Oxygen, a pulse oximeter, a blood pressure cuff, dressings, and a defibrillator are appropriate to look for if they are manifested.",
    "Do not use unlabeled vials or medications Mission Control has not directed.",
    "This app will not name a dose or a controlled medication.",
  ];
}

function formatVitals(vitals: Vitals): string {
  const parts: string[] = [];
  if (vitals.hr != null) parts.push(`HR ${vitals.hr}`);
  if (vitals.rr != null) parts.push(`RR ${vitals.rr}`);
  if (vitals.spo2 != null) parts.push(`SpO2 ${vitals.spo2}%`);
  if (vitals.pain != null) parts.push(`pain ${vitals.pain}/10`);
  if (vitals.bpSys != null && vitals.bpDia != null) {
    parts.push(`BP ${vitals.bpSys}/${vitals.bpDia}`);
  }
  return parts.length ? parts.join(", ") : "not reported";
}

function hasVitals(vitals: Vitals): boolean {
  return (
    vitals.hr != null ||
    vitals.rr != null ||
    vitals.spo2 != null ||
    vitals.pain != null ||
    vitals.bpSys != null
  );
}

function answersAfter(history: HistoryTurn[], slot: NonNullable<MedicReply["slot"]>): string[] {
  const answers: string[] = [];
  let armed = false;
  for (const turn of history) {
    if (turn.role === "assistant" && turn.slot === slot) {
      armed = true;
      continue;
    }
    if (armed && turn.role === "user") answers.push(turn.content);
  }
  return answers;
}

function latestUser(history: HistoryTurn[]): string {
  for (let i = history.length - 1; i >= 0; i -= 1) {
    if (history[i].role === "user") return history[i].content;
  }
  return "";
}
