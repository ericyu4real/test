import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  async rewrites() {
    return [
      {
        source: "/summary",
        destination: "http://localhost:8000/summary",
      },
    ];
  },
};

export default nextConfig;
