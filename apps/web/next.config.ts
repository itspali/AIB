import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    return [
      { source: "/items", destination: "/inventory/items", permanent: true },
      { source: "/items/categories", destination: "/inventory/categories", permanent: true },
    ];
  },
};

export default nextConfig;
