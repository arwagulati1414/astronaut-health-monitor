import { NextResponse } from "next/server";
import { adviseWithGemini } from "@/lib/gemini";
import { adviseOffline } from "@/lib/offline-engine";
import { isEnvironment, type HistoryTurn, type MedicRequest } from "@/lib/types";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON." }, { status: 400 });
  }

  if (!isMedicRequest(body)) {
    return NextResponse.json(
      { error: "Environment and history are required." },
      { status: 400 },
    );
  }

  const offline = adviseOffline(body);
  const apiKey =
    process.env.GEMINI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json(offline);
  }

  try {
    const reply = await adviseWithGemini(body, offline, apiKey);
    return NextResponse.json(reply);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Gemini unavailable, using offline rules: ${message.slice(0, 300)}`);
    return NextResponse.json(offline);
  }
}

function isMedicRequest(value: unknown): value is MedicRequest {
  if (!value || typeof value !== "object") return false;
  const body = value as { environment?: unknown; history?: unknown; eyeHandoffLogged?: unknown };
  if (!isEnvironment(body.environment) || !Array.isArray(body.history)) return false;
  return body.history.every(isTurn);
}

function isTurn(value: unknown): value is HistoryTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as { role?: unknown; content?: unknown };
  return (
    (turn.role === "user" || turn.role === "assistant") &&
    typeof turn.content === "string" &&
    turn.content.length <= 4_000
  );
}
