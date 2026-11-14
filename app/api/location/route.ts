import { matchZone, zoneById } from "@/lib/ship/zones";
import { serverSupabase } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  const input = body as { text?: unknown; zoneId?: unknown; astronautId?: unknown };
  const zone =
    typeof input.zoneId === "string"
      ? zoneById(input.zoneId)
      : typeof input.text === "string"
        ? matchZone(input.text)
        : null;
  if (!zone) {
    return Response.json({
      locationId: null,
      locationLabel: null,
      clarify: "Which module? Command deck, crew quarters, medical bay, lab, galley, gym, engineering, airlock, cargo bay, greenhouse, or the main corridor.",
    });
  }
  const supabase = serverSupabase();
  if (supabase && typeof input.astronautId === "string") {
    await supabase.from("crew_locations").insert({
      astronaut_id: input.astronautId,
      zone_id: zone.id,
      source: "chat",
    });
  }
  return Response.json({ locationId: zone.id, locationLabel: zone.label });
}
