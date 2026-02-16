import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['172.18.112.1'],
  async redirects() {
    return [
      { source: "/IT_Admin", destination: "/Super_Admin", permanent: false },
      { source: "/IT_Admin/:path*", destination: "/Super_Admin/:path*", permanent: false },
      { source: "/it-admin", destination: "/Super_Admin", permanent: false },
      { source: "/it-admin/:path*", destination: "/Super_Admin/:path*", permanent: false },
      { source: "/super-admin", destination: "/Super_Admin", permanent: false },
      { source: "/super-admin/:path*", destination: "/Super_Admin/:path*", permanent: false },
    ];
  },
  async rewrites() {
    return [
      { source: "/api/it_admin/:path*", destination: "/api/super_admin/:path*" },
      { source: "/api/it-admin/:path*", destination: "/api/super_admin/:path*" },
      { source: "/api/super-admin/:path*", destination: "/api/super_admin/:path*" },
    ];
  },
};

export default nextConfig;
