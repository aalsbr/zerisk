import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Lean, self-contained server bundle for Docker / Coolify deployment.
  output: "standalone",
  // Server Actions run behind Coolify's Traefik reverse proxy, where the request
  // Origin (public host) differs from the internal container host. Without this
  // allowlist Next.js rejects the action POST and mutations silently fail.
  experimental: {
    serverActions: {
      allowedOrigins: [
        "zerisk.168.119.63.163.sslip.io",
        "*.sslip.io",
        "168.119.63.163",
        "localhost:3000",
      ],
    },
  },
};

export default nextConfig;
