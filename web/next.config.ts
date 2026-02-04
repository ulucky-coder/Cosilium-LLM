import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow external dev connections - specify all possible origins
  allowedDevOrigins: [
    "82.26.93.78",
    "82.26.93.78:3000",
    "82.26.93.78:3001",
    "82.26.93.78:3002",
    "localhost",
    "localhost:3000",
    "localhost:3001",
    "localhost:3002",
  ],

  // Ensure proper compilation
  reactStrictMode: true,
};

export default nextConfig;
