const SCENARIOS = new Set(["normal", "chest", "co2", "reset"]);

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }
  const scenario = (body as { scenario?: unknown }).scenario;
  if (typeof scenario !== "string" || !SCENARIOS.has(scenario)) {
    return Response.json({ error: "Scenario must be normal, chest, co2, or reset." }, { status: 400 });
  }
  return Response.json({
    ok: true,
    scenario: scenario === "reset" ? "normal" : scenario,
    note: "The live demo drives vitals in the browser. This route confirms the scenario name.",
  });
}
