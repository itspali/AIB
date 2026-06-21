import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    optimizePackageImports: ["lucide-react"],
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
      { source: "/logistics", destination: "/fulfillment/shipping", permanent: true },
      { source: "/logistics/:path*", destination: "/fulfillment/shipping/:path*", permanent: true },
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
