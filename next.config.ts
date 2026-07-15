import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,

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
