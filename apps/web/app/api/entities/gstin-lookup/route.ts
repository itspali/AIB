import { NextResponse } from "next/server";
import {
  mapGstPortalPayload,
  mapGstVerifyPayload,
  parseGstinLocally,
  validateGstin,
} from "@/lib/entities/gstin";
import { requireTenantId } from "@/lib/supabase/require-tenant";

async function fetchGstVerifyDetails(gstin: string) {
  const apiKey = process.env.GST_VERIFY_API_KEY?.trim();
  if (!apiKey) return null;

  const response = await fetch(`https://gstverify.co.in/api/v1/verify/${encodeURIComponent(gstin)}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "X-API-Key": apiKey,
    },
    next: { revalidate: 86_400 },
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    success?: boolean;
    data?: Record<string, unknown>;
  };

  if (!payload.success || !payload.data) return null;
  return payload.data;
}

async function fetchSandboxDetails(gstin: string) {
  const apiKey = process.env.SANDBOX_API_KEY?.trim();
  const accessToken = process.env.SANDBOX_ACCESS_TOKEN?.trim();
  if (!apiKey || !accessToken) return null;

  const response = await fetch("https://api.sandbox.co.in/gst/compliance/public/gstin/verify", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      authorization: accessToken,
      "x-api-version": "1.0.0",
    },
    body: JSON.stringify({ gstin }),
    next: { revalidate: 86_400 },
  });

  if (!response.ok) return null;

  const payload = (await response.json()) as {
    code?: number;
    data?: { data?: Record<string, unknown> };
  };

  if (payload.code !== 200 || !payload.data?.data) return null;

  const row = payload.data.data;
  return {
    legal_name: row.legalName,
    trade_name: row.legalName,
    status: row.status,
    taxpayer_type: row.bussNature,
    state: row.stateName,
    pan: row.pan,
    gstin: row.gstin,
  } satisfies Record<string, unknown>;
}

export async function GET(request: Request) {
  try {
    await requireTenantId();
  } catch {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const gstin = new URL(request.url).searchParams.get("gstin") ?? "";
  const validationError = validateGstin(gstin);
  if (validationError) {
    return NextResponse.json({ error: validationError }, { status: 400 });
  }

  const local = parseGstinLocally(gstin);

  const gstVerify = await fetchGstVerifyDetails(local.gstin);
  if (gstVerify) {
    return NextResponse.json(mapGstVerifyPayload(gstVerify, local));
  }

  const sandbox = await fetchSandboxDetails(local.gstin);
  if (sandbox) {
    return NextResponse.json(mapGstVerifyPayload(sandbox, local));
  }

  const gstPortalUrl = process.env.GST_PORTAL_LOOKUP_URL?.trim();
  if (gstPortalUrl) {
    const url = new URL(gstPortalUrl);
    url.searchParams.set("gstin", local.gstin);
    url.searchParams.set("action", "TP");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: { Accept: "application/json" },
      next: { revalidate: 86_400 },
    });

    if (response.ok) {
      const payload = (await response.json()) as Record<string, unknown>;
      return NextResponse.json(mapGstPortalPayload(payload, local));
    }
  }

  return NextResponse.json(local);
}
