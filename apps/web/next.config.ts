import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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

export default nextConfig;
