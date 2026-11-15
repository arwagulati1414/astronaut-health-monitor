import { rateLimit } from "@/lib/ai/rate-limit";
import { IMAGE_PIXELS } from "@/lib/eye-screen/features";
import { screenEye } from "@/lib/eye-screen/model";

export async function POST(request: Request) {
  const ip = request.headers.get("x-forwarded-for") ?? "local";
  if (!rateLimit(`eye-screen:${ip}`)) {
    return Response.json({ error: "Rate limit. Wait a minute and try again." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Expected JSON." }, { status: 400 });
  }

  const pixels = isPixelBody(body) ? body.pixels : null;
  if (!pixels) {
    return Response.json({ error: "Expected a 32 by 32 RGB still." }, { status: 400 });
  }

  return Response.json(screenEye(pixels));
}

function isPixelBody(body: unknown): body is { pixels: number[] } {
  if (!body || typeof body !== "object" || !("pixels" in body)) return false;
  const pixels = (body as { pixels: unknown }).pixels;
  return (
    Array.isArray(pixels) &&
    pixels.length === IMAGE_PIXELS &&
    pixels.every((value) => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 1)
  );
}
