import { serverSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return Response.json({ error: "Alert body required." }, { status: 400 });
  }
  const alert = body as { message?: unknown; severity?: unknown; zoneId?: unknown; astronautId?: unknown };
  if (typeof alert.message !== "string" || !alert.message.trim()) {
    return Response.json({ error: "Message required." }, { status: 400 });
  }
  const row = {
    message: alert.message.slice(0, 500),
    severity: alert.severity === "critical" || alert.severity === "warning" ? alert.severity : "info",
    zone_id: typeof alert.zoneId === "string" ? alert.zoneId : null,
    astronaut_id: typeof alert.astronautId === "string" ? alert.astronautId : null,
    type: "crew",
    status: "open",
  };
  const supabase = serverSupabase();
  if (supabase) {
    await supabase.from("alerts").insert(row);
    await supabase.from("audit_log").insert({
      actor: "crew",
      action: "alert.create",
      entity: "alerts",
      payload: row,
    });
  }
  return Response.json({ ok: true, stored: Boolean(supabase), alert: row });
}
