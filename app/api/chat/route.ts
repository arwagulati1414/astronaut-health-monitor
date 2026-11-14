import { adviseWithGemini } from "@/lib/gemini";
import { protocolContext } from "@/lib/ai/systemPrompt";
import { decisionFromMedic } from "@/lib/ai/schema";
import { rateLimit } from "@/lib/ai/rate-limit";
import { adviseOffline } from "@/lib/offline-engine";
import { matchZone } from "@/lib/ship/zones";
import { isEnvironment, type FollowUpSlot, type HistoryTurn, type MedicReply } from "@/lib/types";

const SLOTS = new Set<FollowUpSlot>([
  "avpu",
  "location",
  "vitals",
  "character",
  "eye-which",
  "eye-mechanism",
  "eye-severity",
  "status",
  "chief",
]);

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(ip)) {
    return Response.json({ error: "Rate limit. Wait a minute and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }

  if (!isChatBody(body)) {
    return Response.json({ error: "Environment and history are required." }, { status: 400 });
  }

  const history = body.history.map((turn) => ({
    role: turn.role,
    content: turn.content,
    slot: turn.slot && SLOTS.has(turn.slot as FollowUpSlot) ? (turn.slot as FollowUpSlot) : null,
  }));
  const medicRequest = {
    environment: body.environment,
    eyeHandoffLogged: body.eyeHandoffLogged,
    history,
  };
  const offline = adviseOffline(medicRequest);
  const apiKey = process.env.GEMINI_API_KEY?.trim() || process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();
  let reply: MedicReply = offline;
  if (apiKey) {
    try {
      reply = await adviseWithGemini(medicRequest, offline, apiKey);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`Chat Gemini fallback: ${message.slice(0, 240)}`);
    }
  }

  const latestUser = [...history].reverse().find((turn) => turn.role === "user")?.content ?? "";
  const zone = matchZone(latestUser);
  const decision = decisionFromMedic(reply);
  const payload = {
    ...reply,
    decision,
    protocol: protocolContext(latestUser),
    locationId: zone?.id ?? null,
    locationLabel: zone?.label ?? null,
  };

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
}

function isChatBody(value: unknown): value is {
  environment: "spacecraft" | "space-station" | "lunar-surface";
  eyeHandoffLogged?: boolean;
  history: HistoryTurn[];
} {
  if (!value || typeof value !== "object") return false;
  const body = value as { environment?: unknown; history?: unknown; eyeHandoffLogged?: unknown };
  if (!isEnvironment(body.environment) || !Array.isArray(body.history)) return false;
  return body.history.every((turn) => {
    if (!turn || typeof turn !== "object") return false;
    const item = turn as { role?: unknown; content?: unknown };
    return (item.role === "user" || item.role === "assistant") && typeof item.content === "string";
  });
}
