import { GoogleGenerativeAI } from "@google/generative-ai";
import { protocolContext, SYSTEM_PROMPT } from "./ai/systemPrompt";
import { reconcileAdvice } from "./reconcile";
import type { MedicReply, MedicRequest } from "./types";

const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-2.5-flash-lite", "gemini-flash-latest"];

export async function adviseWithGemini(
  request: MedicRequest,
  offline: MedicReply,
  apiKey: string,
): Promise<MedicReply> {
  const preferred = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  const models = [preferred, ...FALLBACK_MODELS.filter((name) => name !== preferred)];
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: unknown;

  for (const modelName of models) {
    try {
      return await generateReply(genAI, modelName, promptFor(request, offline), offline);
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Gemini model ${modelName} failed: ${message.slice(0, 300)}`);
    }
  }

  throw lastError;
}

function promptFor(request: MedicRequest, offline: MedicReply): string {

  const transcript = request.history
    .map((turn) => `${turn.role.toUpperCase()}: ${turn.content}`)
    .join("\n");
  const latestUser = [...request.history].reverse().find((turn) => turn.role === "user")?.content ?? "";

  const prompt = `You are a flight-medic decision-support assistant for a spacecraft crew demo.
Write educational first-aid guidance. You are not a physician on this loop, you do not diagnose, you do not prescribe, and you do not claim to be an official NASA protocol.
Never give drug doses. Never recommend morphine, fentanyl, ketamine, benzodiazepines, epinephrine, insulin, or any unlabeled injectable.
Urgency must be at least "${offline.urgency}". If you are unsure, keep the draft urgency.
Return only JSON with these keys: urgency, assessmentSummary, immediateSteps, vitalsNext, redFlags, environmentNotes, kitGuidance, followUpQuestion, quickReplies, disclaimer, source.
Set source to "gemini". Keep immediateSteps as short numbered actions (the array order is the numbering). One follow-up question only.

Environment: ${request.environment}
Eye handoff photo logged: ${request.eyeHandoffLogged ? "yes" : "no"}

Transcript:
${transcript || "(no transcript)"}

Safety draft you must not undercut:
${JSON.stringify(offline)}

${SYSTEM_PROMPT}

Protocol context:
${protocolContext(latestUser)}`;
  return prompt;
}

async function generateReply(
  genAI: GoogleGenerativeAI,
  modelName: string,
  prompt: string,
  offline: MedicReply,
): Promise<MedicReply> {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
    },
  });

  const result = await Promise.race([
    model.generateContent(prompt),
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("Gemini timed out")), 15_000);
    }),
  ]);

  const text = result.response.text().trim();
  const parsed: unknown = JSON.parse(stripFences(text));
  return reconcileAdvice(offline, parsed);
}

function stripFences(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced ? fenced[1].trim() : text;
}
