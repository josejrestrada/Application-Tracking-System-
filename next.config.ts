import type { NextConfig } from "next";
import path from "path";

const projectRoot = path.join(__dirname);

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  turbopack: {
    root: projectRoot,
  },
  serverExternalPackages: ["better-sqlite3"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
