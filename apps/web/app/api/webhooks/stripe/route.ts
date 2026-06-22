import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Stripe subscription webhook placeholder (Phase 5).
 * Wire signature verification with the `stripe` package when billing goes live.
 * See docs/APP_CONSOLE_PHASES.md — set STRIPE_WEBHOOK_SECRET and STRIPE_SECRET_KEY.
 */
export async function POST(request: Request) {
  if (!process.env.STRIPE_WEBHOOK_SECRET || !process.env.STRIPE_SECRET_KEY) {
    return NextResponse.json({ error: "Stripe webhook is not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  await request.text();

  return NextResponse.json(
    {
      received: true,
      note: "Install stripe package and implement event handling in this route.",
    },
    { status: 501 }
  );
}
