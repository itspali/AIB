import type { NextConfig } from "next";

const isWindows = process.platform === "win32";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  experimental: {
    // Avoid SegmentViewNode React Client Manifest errors during HMR on Windows.
    devtoolSegmentExplorer: false,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable webpack cache in dev to avoid stale/missing chunk errors on Windows.
      config.cache = false;
      if (isWindows) {
        config.watchOptions = {
          poll: 1000,
          aggregateTimeout: 500,
        };
      }
    }
    return config;
  },
};

export default nextConfig;
