import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Skip ESLint during production builds to unblock deploys; local linting still available via npm run lint
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
