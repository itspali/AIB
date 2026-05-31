import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/items", destination: "/inventory/items", permanent: true },
      { source: "/items/categories", destination: "/inventory/categories", permanent: true },
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
