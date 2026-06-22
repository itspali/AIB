import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

function buildContentSecurityPolicy(): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  let connectSources = "'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com";
  try {
    if (supabaseUrl) {
      const host = new URL(supabaseUrl).host;
      connectSources = `'self' https://${host} wss://${host} https://api.stripe.com`;
    }
  } catch {
    /* keep wildcard default */
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `connect-src ${connectSources}`,
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  ];

  return directives.join("; ");
}

const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  {
    key: "Content-Security-Policy-Report-Only",
    value: buildContentSecurityPolicy(),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      { source: "/inventory/items", destination: "/items", permanent: true },
      { source: "/inventory/items/:path*", destination: "/items/:path*", permanent: true },
      { source: "/inventory/categories", destination: "/items/categories", permanent: true },
      {
        source: "/inventory/categories/:path*",
        destination: "/items/categories/:path*",
        permanent: true,
      },
      { source: "/logistics", destination: "/fulfillment", permanent: true },
      { source: "/logistics/:path*", destination: "/fulfillment/:path*", permanent: true },
      { source: "/inventory/locations", destination: "/settings/locations", permanent: true },
      {
        source: "/inventory/locations/topology",
        destination: "/settings/locations/topology",
        permanent: true,
      },
      { source: "/inventory/uom", destination: "/settings/uom", permanent: true },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);
