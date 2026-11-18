import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: { bodySizeLimit: "2mb" }, // files go straight to R2, not through the server
  },
  images: { unoptimized: true },
};

export default nextConfig;
