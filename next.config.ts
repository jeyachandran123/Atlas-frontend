import type { NextConfig } from "next";

const BACKEND_URL = process.env.ATLAS_BACKEND_URL || "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,

  // Proxy API calls to the FastAPI backend during development.
  // In production, set NEXT_PUBLIC_API_BASE_URL directly and skip this proxy,
  // or keep it if Next.js sits in front of FastAPI behind the same domain.
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${BACKEND_URL}/api/v1/:path*`,
      },
    ];
  },

  experimental: {
    optimizePackageImports: ["lucide-react", "@radix-ui/react-icons"],
  },
};

export default nextConfig;
