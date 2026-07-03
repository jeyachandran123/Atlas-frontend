import type { NextConfig } from "next";

const BACKEND_URL = process.env.ATLAS_BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },

  // Disable response buffering for SSE (streaming chat) routes.
  // Without this Next.js buffers the entire response before forwarding.
  async headers() {
    return [
      {
        source: "/api/backend/chat/stream",
        headers: [
          { key: "X-Accel-Buffering", value: "no" },
          { key: "Cache-Control", value: "no-cache, no-transform" },
          { key: "Content-Type", value: "text/event-stream" },
        ],
      },
    ];
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
};

export default nextConfig;
