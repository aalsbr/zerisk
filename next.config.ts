import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lean, self-contained server bundle for Docker / Coolify deployment.
  output: "standalone",
};

export default nextConfig;
