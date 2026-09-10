import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@poker/ui", "@poker/protocol"]
};

export default nextConfig;
