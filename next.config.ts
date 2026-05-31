import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    webpackBuildWorker: false,
  },
  outputFileTracingRoot: process.cwd(),
  reactStrictMode: true,
};

export default nextConfig;
